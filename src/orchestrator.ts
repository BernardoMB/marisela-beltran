import fs from "fs-extra";
import path from "node:path";
import { acquireSites } from "./agents/site-acquirer.js";
import { extractDesignSystems } from "./agents/design-extractor.js";
import { buildFeatureInventories, computeFeatureUnion } from "./agents/feature-inventory.js";
import { synthesizeContent } from "./agents/content-synthesizer.js";
import { generateProjects, loadGeneratedProjects } from "./agents/ui-generator.js";
import { validateProjects } from "./agents/validator.js";
import { packageProjects } from "./agents/packager.js";
import { planTaskGraph, updateTaskStatus, writeTaskGraph } from "./agents/planner.js";
import { writeReport } from "./agents/reporter.js";
import type { InspirationSite, PipelineRun, RunSummary } from "./types/pipeline.js";
import { Checkpoint, PHASES, clearSentinels, stepStatus, type PhaseId } from "./utils/checkpoint.js";
import type { FactoryContext } from "./utils/config.js";
import { formatDuration, sha1, slugifyUrl } from "./utils/file-utils.js";
import type { Logger } from "./utils/logger.js";

/**
 * Master pipeline coordinator — a small state machine over nine phases (AgentMesh pattern:
 * Planner → specialists → Coder → Debugger → Reviewer → reporter).
 * Checkpointing follows site-facelift: STEPN_COMPLETED sentinels at the repo root mark finished
 * phases (skipped on the next run); `.orchestrator-state.json` tracks per-item progress inside a phase.
 */

export type PhaseHandler = (run: PipelineRun) => Promise<Record<string, unknown> | void>;
export type PhaseHandlers = Record<PhaseId, PhaseHandler>;

/** Task-graph node prefix updated when a phase finishes. */
const PHASE_NODES: Record<PhaseId, string> = {
  PHASE_1_ACQUISITION: "acquire:",
  PHASE_2_DESIGN_EXTRACTION: "extract:",
  PHASE_3_FEATURE_INVENTORY: "inventory:",
  PHASE_4_FEATURE_UNION: "union",
  PHASE_5_CONTENT_SYNTHESIS: "content",
  PHASE_6_UI_GENERATION: "generate:",
  PHASE_7_VALIDATION: "validate:",
  PHASE_8_PACKAGING: "package:",
  PHASE_9_REPORT: "report",
};

export const DEFAULT_HANDLERS: PhaseHandlers = {
  PHASE_1_ACQUISITION: async (run) => {
    const r = await acquireSites(run);
    return { acquired: r.filter((x) => x.ok).length, total: r.length };
  },
  PHASE_2_DESIGN_EXTRACTION: async (run) => {
    const r = await extractDesignSystems(run);
    return { chhapify: r.filter((x) => x.ok).length, defaults: r.filter((x) => !x.ok).length };
  },
  PHASE_3_FEATURE_INVENTORY: async (run) => {
    const r = await buildFeatureInventories(run);
    return { manifests: r.length, baseline: r.filter((x) => x.usedBaseline).length };
  },
  PHASE_4_FEATURE_UNION: async (run) => {
    const u = await computeFeatureUnion(run);
    return { featureTypes: u.featureTypes };
  },
  PHASE_5_CONTENT_SYNTHESIS: async (run) => {
    const { document } = await synthesizeContent(run);
    return { name: document.name, releases: document.discography.length, verifiedClaims: document.meta.claims.filter((c) => c.status === "verified").length };
  },
  PHASE_6_UI_GENERATION: async (run) => {
    const projects = await generateProjects(run);
    return { projects: projects.map((p) => p.projectName) };
  },
  PHASE_7_VALIDATION: async (run) => {
    const r = await validateProjects(run, await loadGeneratedProjects(run.ctx));
    return { passed: r.filter((x) => x.passed).length, total: r.length };
  },
  PHASE_8_PACKAGING: async (run) => {
    const r = await packageProjects(run, await loadGeneratedProjects(run.ctx));
    return { built: r.filter((x) => x.built).length, total: r.length };
  },
  PHASE_9_REPORT: async (run) => {
    const r = await writeReport(run);
    return { report: r.markdownFile };
  },
};

export function buildSites(urls: string[]): InspirationSite[] {
  const used = new Map<string, number>();
  return urls.map((url, index) => {
    const base = slugifyUrl(url);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return { url, slug: n === 1 ? base : `${base}-${n}`, index };
  });
}

export class Orchestrator {
  private readonly handlers: PhaseHandlers;

  constructor(
    private readonly ctx: FactoryContext,
    private readonly logger: Logger,
    handlers?: Partial<PhaseHandlers>,
  ) {
    this.handlers = { ...DEFAULT_HANDLERS, ...handlers };
  }

  /**
   * One cumulative hash per phase of the inputs it depends on, so that a settings change re-runs
   * only the phases it affects (e.g. editing design-briefs.json regenerates the sites but reuses
   * the research of phases 1–5).
   */
  private async fingerprints(urls: string[]): Promise<string[]> {
    const { config, paths, briefs } = this.ctx;
    const file = async (abs: string) => ((await fs.pathExists(abs)) ? await fs.readFile(abs, "utf8") : "");
    const prompts = await Promise.all(briefs.map((b) => file(path.join(paths.root, b.promptFile))));
    const inputs: Record<number, unknown[]> = {
      1: [urls, config.acquisition],
      2: [config.tools.chhapify],
      3: [await file(path.join(paths.configDir, "feature-map.json")), config.tools.clooney],
      4: [],
      5: [await file(path.join(paths.configDir, "artist.json")), config.tools.contentFetch, config.siteLanguage, config.locale],
      6: [await file(path.join(paths.configDir, "design-briefs.json")), config.variations, config.generation, config.tools.jsonRender, prompts],
      7: [config.tools.facelift],
      8: [config.packaging],
      9: [],
    };
    let previous = "";
    return PHASES.map((def) => (previous = sha1([previous, JSON.stringify(inputs[def.n])].join("\n--\n"))));
  }

  async run(urls: string[]): Promise<RunSummary> {
    const { ctx, logger } = this;
    const started = Date.now();
    const sites = buildSites(urls);
    const { checkpoint, changedFromPhase } = await Checkpoint.open(ctx.paths.root, ctx.paths.stateFile, await this.fingerprints(urls), { fresh: ctx.flags.fresh });
    if (changedFromPhase === 1) logger.warn("The inspiration URLs or research settings changed since the last run — starting a fresh run");
    else if (changedFromPhase) logger.warn(`Settings used from phase ${changedFromPhase} onwards changed since the last run — re-running from phase ${changedFromPhase} (earlier results are reused)`);
    else if (!ctx.flags.fresh && Object.values(checkpoint.state.phases).some((ph) => ph.status === "completed")) logger.info(`Resuming run ${checkpoint.state.runId}`);
    if (ctx.flags.fromPhase) {
      await clearSentinels(ctx.paths.root, ctx.flags.fromPhase);
      for (const def of PHASES) {
        if (def.n >= ctx.flags.fromPhase) {
          await checkpoint.resetItems(def.id);
          checkpoint.phase(def.id).status = "pending";
        }
      }
      await checkpoint.save();
      logger.info(`Re-running from phase ${ctx.flags.fromPhase}`);
    }

    const run: PipelineRun = { ctx, logger, checkpoint, sites };
    logger.info(`Run ${checkpoint.state.runId}: ${sites.length} inspiration URL(s) → ${ctx.briefs.length} site(s) [${ctx.briefs.map((b) => b.name).join(", ")}]`);
    await writeTaskGraph(run, planTaskGraph(run));
    await updateTaskStatus(run, "plan", "completed");

    for (const def of PHASES) {
      if (def.sentinel && (await stepStatus(ctx.paths.root, def.n)) === "completed") {
        logger.info(`Phase ${def.n} already completed — skipping (delete STEP${def.n}_COMPLETED to force a re-run)`);
        if (checkpoint.phase(def.id).status !== "completed") await checkpoint.completePhase(def.id);
        await updateTaskStatus(run, PHASE_NODES[def.id], "completed");
        continue;
      }
      await checkpoint.startPhase(def.id);
      await updateTaskStatus(run, PHASE_NODES[def.id], "running");
      const phaseStarted = Date.now();
      try {
        const summary = await logger.withSpinner(`Phase ${def.n}/9: ${def.title}`, async () => this.handlers[def.id](run), () => `Phase ${def.n}/9: ${def.title} (${formatDuration(Date.now() - phaseStarted)})`);
        await checkpoint.completePhase(def.id, summary ?? undefined);
        await this.syncItemStatuses(run, def.id);
      } catch (err) {
        await checkpoint.failPhase(def.id, err);
        await updateTaskStatus(run, PHASE_NODES[def.id], "failed");
        logger.error(`Phase ${def.n} (${def.title}) failed — STEP${def.n}_FAILED written. Fix the cause and run \`npm start\` again to resume.`, err);
        throw err;
      }
    }

    const projects = await loadGeneratedProjects(ctx);
    const report = await writeReport(run);
    logger.success(`Generated ${projects.length} projects in ${path.relative(ctx.paths.root, ctx.paths.outputDir) || ctx.paths.outputDir}/ in ${formatDuration(Date.now() - started)}`);
    for (const p of report.summary.projects) logger.info(`Run: ${p.runCommand}`);
    return { ...report.summary, durationMs: Date.now() - started };
  }

  /** Mirror per-item checkpoint statuses into the task graph. */
  private async syncItemStatuses(run: PipelineRun, phase: PhaseId): Promise<void> {
    const prefix = PHASE_NODES[phase];
    const items = run.checkpoint.phase(phase).items;
    if (!prefix.endsWith(":") || !Object.keys(items).length) {
      await updateTaskStatus(run, prefix, "completed");
      return;
    }
    for (const [key, item] of Object.entries(items)) {
      const status = item.status === "running" || item.status === "pending" ? "pending" : item.status;
      await updateTaskStatus(run, `${prefix}${key}`, status);
    }
  }
}
