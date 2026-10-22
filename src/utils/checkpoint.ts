import path from "node:path";
import fs from "fs-extra";
import { isoTimestamp } from "./logger.js";
import { readJsonIfExists, writeJson } from "./file-utils.js";

/**
 * Resumability, following the site-facelift pattern:
 * step-level progress is tracked with `STEPN_COMPLETED` sentinel files at the run root.
 * While a step runs, `STEPN_RUNNING` exists; on success it is renamed to `STEPN_COMPLETED`;
 * on failure `STEPN_FAILED` (containing the error) is written. On the next run, every step
 * whose sentinel exists is skipped.
 *
 * Item-level progress (per URL / per project) is stored in `.orchestrator-state.json`, so a
 * crash on project 4 of 6 resumes at project 4.
 */

export const PHASES = [
  { n: 1, id: "PHASE_1_ACQUISITION", title: "Acquire inspirational sites (HTML/CSS/JS + DOM snapshot)", sentinel: true },
  { n: 2, id: "PHASE_2_DESIGN_EXTRACTION", title: "Extract design systems (chhapify)", sentinel: true },
  { n: 3, id: "PHASE_3_FEATURE_INVENTORY", title: "Build feature inventories (Clooney-Agent + DOM analyzer)", sentinel: true },
  { n: 4, id: "PHASE_4_FEATURE_UNION", title: "Compute feature union", sentinel: true },
  { n: 5, id: "PHASE_5_CONTENT_SYNTHESIS", title: "Synthesize artist content from public sources", sentinel: true },
  { n: 6, id: "PHASE_6_UI_GENERATION", title: "Generate Next.js projects (json-render)", sentinel: true },
  { n: 7, id: "PHASE_7_VALIDATION", title: "Validate projects (site-facelift)", sentinel: true },
  { n: 8, id: "PHASE_8_PACKAGING", title: "Install, build and package projects", sentinel: true },
  { n: 9, id: "PHASE_9_REPORT", title: "Write summary report", sentinel: false },
] as const;

export type PhaseDef = (typeof PHASES)[number];
export type PhaseId = PhaseDef["id"];
export type PhaseNumber = PhaseDef["n"];

export type StepStatus = "not_started" | "running" | "completed" | "failed";
export type PhaseStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type ItemStatus = "pending" | "running" | "completed" | "degraded" | "failed";

export interface ItemState {
  status: ItemStatus;
  detail?: string;
  updatedAt: string;
}

export interface PhaseState {
  status: PhaseStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  /** Per-item progress, keyed by URL slug or project name. */
  items: Record<string, ItemState>;
  /** Free-form summary written by the phase (counts, chosen options, …). */
  summary?: Record<string, unknown>;
}

export interface OrchestratorState {
  version: 2;
  runId: string;
  startedAt: string;
  updatedAt: string;
  /**
   * Cumulative hash of the inputs each phase depends on (index 0 = phase 1, each entry also covers
   * all earlier phases). On the next run, the first phase whose hash differs and every later phase
   * are re-run; earlier phases are reused.
   */
  phaseFingerprints: string[];
  currentPhase: PhaseId | null;
  phases: Record<PhaseId, PhaseState>;
}

export function phaseByNumber(n: number): PhaseDef {
  const def = PHASES.find((p) => p.n === n);
  if (!def) throw new Error(`Unknown phase number ${n}`);
  return def;
}

export function phaseById(id: PhaseId): PhaseDef {
  const def = PHASES.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown phase id ${id}`);
  return def;
}

// ---------------------------------------------------------------------------
// Sentinels
// ---------------------------------------------------------------------------

export function sentinelPath(root: string, step: number, kind: "COMPLETED" | "RUNNING" | "FAILED"): string {
  return path.join(root, `STEP${step}_${kind}`);
}

export async function stepStatus(root: string, step: number): Promise<StepStatus> {
  if (await fs.pathExists(sentinelPath(root, step, "COMPLETED"))) return "completed";
  if (await fs.pathExists(sentinelPath(root, step, "FAILED"))) return "failed";
  if (await fs.pathExists(sentinelPath(root, step, "RUNNING"))) return "running";
  return "not_started";
}

export async function markRunning(root: string, step: number): Promise<void> {
  await fs.ensureDir(root);
  await fs.remove(sentinelPath(root, step, "COMPLETED"));
  await fs.remove(sentinelPath(root, step, "FAILED"));
  await fs.writeFile(sentinelPath(root, step, "RUNNING"), `${isoTimestamp()}\n`);
}

export async function markCompleted(root: string, step: number, note = ""): Promise<void> {
  const running = sentinelPath(root, step, "RUNNING");
  const completed = sentinelPath(root, step, "COMPLETED");
  try {
    await fs.rename(running, completed);
  } catch {
    // RUNNING may be missing (manual cleanup) — just create COMPLETED.
  }
  await fs.writeFile(completed, `${isoTimestamp()}${note ? ` ${note}` : ""}\n`);
}

export async function markFailed(root: string, step: number, error: unknown): Promise<void> {
  await fs.remove(sentinelPath(root, step, "RUNNING"));
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  await fs.writeFile(sentinelPath(root, step, "FAILED"), `${isoTimestamp()}\n${message}\n`);
}

/** Remove every sentinel for steps >= `fromStep` (default: all). */
export async function clearSentinels(root: string, fromStep = 1): Promise<void> {
  for (const def of PHASES) {
    if (def.n < fromStep) continue;
    for (const kind of ["COMPLETED", "RUNNING", "FAILED"] as const) {
      await fs.remove(sentinelPath(root, def.n, kind));
    }
  }
}

// ---------------------------------------------------------------------------
// State file
// ---------------------------------------------------------------------------

function emptyPhases(): Record<PhaseId, PhaseState> {
  const out = {} as Record<PhaseId, PhaseState>;
  for (const def of PHASES) out[def.id] = { status: "pending", items: {} };
  return out;
}

export function newState(phaseFingerprints: string[]): OrchestratorState {
  const now = isoTimestamp();
  return {
    version: 2,
    runId: `run-${now.replace(/[-:]/g, "").replace("T", "-").replace("Z", "")}`,
    startedAt: now,
    updatedAt: now,
    phaseFingerprints,
    currentPhase: null,
    phases: emptyPhases(),
  };
}

/** First phase number whose fingerprint differs (1 for a state without fingerprints), or null if all match. */
export function firstChangedPhase(previous: string[] | undefined, current: string[]): number | null {
  if (!previous?.length) return 1;
  for (const def of PHASES) {
    if (previous[def.n - 1] !== current[def.n - 1]) return def.n;
  }
  return null;
}

/**
 * Wrapper around `.orchestrator-state.json`. Every mutation is persisted immediately
 * (atomic write), so a crash never loses completed work.
 */
export class Checkpoint {
  readonly root: string;
  readonly stateFile: string;
  state: OrchestratorState;

  private constructor(root: string, stateFile: string, state: OrchestratorState) {
    this.root = root;
    this.stateFile = stateFile;
    this.state = state;
  }

  /**
   * Load existing state, or create a new one. `changedFromPhase` is the first phase whose inputs
   * changed since the last run (1 = everything starts over), or null when nothing changed.
   */
  static async open(root: string, stateFile: string, phaseFingerprints: string[], opts: { fresh?: boolean } = {}): Promise<{ checkpoint: Checkpoint; changedFromPhase: number | null }> {
    const existing = await readJsonIfExists<OrchestratorState | null>(stateFile, null);
    let changedFromPhase: number | null = null;
    let state: OrchestratorState;
    if (!existing || opts.fresh) {
      state = newState(phaseFingerprints);
      if (existing) await clearSentinels(root);
    } else {
      changedFromPhase = firstChangedPhase(existing.version === 2 ? existing.phaseFingerprints : undefined, phaseFingerprints);
      if (changedFromPhase === 1) {
        state = newState(phaseFingerprints);
        await clearSentinels(root);
      } else {
        state = { ...existing, phaseFingerprints, phases: { ...emptyPhases(), ...existing.phases } };
        if (changedFromPhase !== null) {
          await clearSentinels(root, changedFromPhase);
          for (const def of PHASES) {
            if (def.n >= changedFromPhase) state.phases[def.id] = { status: "pending", items: {} };
          }
        }
      }
    }
    const checkpoint = new Checkpoint(root, stateFile, state);
    await checkpoint.save();
    return { checkpoint, changedFromPhase };
  }

  async save(): Promise<void> {
    this.state.updatedAt = isoTimestamp();
    await writeJson(this.stateFile, this.state);
  }

  phase(id: PhaseId): PhaseState {
    return this.state.phases[id];
  }

  async startPhase(id: PhaseId): Promise<void> {
    const def = phaseById(id);
    const p = this.phase(id);
    p.status = "running";
    p.startedAt = isoTimestamp();
    p.error = undefined;
    this.state.currentPhase = id;
    if (def.sentinel) await markRunning(this.root, def.n);
    await this.save();
  }

  async completePhase(id: PhaseId, summary?: Record<string, unknown>): Promise<void> {
    const def = phaseById(id);
    const p = this.phase(id);
    p.status = "completed";
    p.finishedAt = isoTimestamp();
    if (p.startedAt) p.durationMs = Date.parse(p.finishedAt) - Date.parse(p.startedAt);
    if (summary) p.summary = { ...(p.summary ?? {}), ...summary };
    if (def.sentinel) await markCompleted(this.root, def.n);
    await this.save();
  }

  async failPhase(id: PhaseId, error: unknown): Promise<void> {
    const def = phaseById(id);
    const p = this.phase(id);
    p.status = "failed";
    p.finishedAt = isoTimestamp();
    p.error = error instanceof Error ? error.message : String(error);
    if (def.sentinel) await markFailed(this.root, def.n, error);
    await this.save();
  }

  async skipPhase(id: PhaseId): Promise<void> {
    const p = this.phase(id);
    if (p.status !== "completed") p.status = "skipped";
    await this.save();
  }

  async setSummary(id: PhaseId, summary: Record<string, unknown>): Promise<void> {
    const p = this.phase(id);
    p.summary = { ...(p.summary ?? {}), ...summary };
    await this.save();
  }

  item(id: PhaseId, key: string): ItemState | undefined {
    return this.phase(id).items[key];
  }

  isItemDone(id: PhaseId, key: string): boolean {
    const s = this.item(id, key)?.status;
    return s === "completed" || s === "degraded";
  }

  async setItem(id: PhaseId, key: string, status: ItemStatus, detail?: string): Promise<void> {
    this.phase(id).items[key] = { status, detail, updatedAt: isoTimestamp() };
    await this.save();
  }

  /** Forget item progress for a phase (used when a phase is re-run from scratch). */
  async resetItems(id: PhaseId): Promise<void> {
    this.phase(id).items = {};
    await this.save();
  }
}
