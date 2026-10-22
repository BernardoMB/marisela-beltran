import type { Checkpoint } from "../utils/checkpoint.js";
import type { FactoryContext } from "../utils/config.js";
import type { Logger } from "../utils/logger.js";
import type { AnalyzerRun } from "../schemas/feature-manifest.js";

/**
 * Shared types passed between the orchestrator and the agents.
 * Every phase persists its results to `artifacts/` (or `generated-websites/<project>/.factory/`)
 * so a resumed run can reload them without re-executing completed work.
 */

export interface InspirationSite {
  /** Normalized absolute URL (https://…). */
  url: string;
  /** `slugifyUrl(url)`, unique within the run (suffixed -2, -3 … on collision). */
  slug: string;
  /** 0-based position in config/urls.txt. */
  index: number;
}

/** Everything an agent needs for one run. Agents must not read config files or argv themselves. */
export interface PipelineRun {
  ctx: FactoryContext;
  logger: Logger;
  checkpoint: Checkpoint;
  sites: InspirationSite[];
}

// ---------------------------------------------------------------------------
// Phase 1 — acquisition (artifacts/acquisition/<slug>/acquisition.json)
// ---------------------------------------------------------------------------

export interface AcquisitionResult {
  url: string;
  slug: string;
  ok: boolean;
  finalUrl?: string;
  title?: string;
  httpStatus?: number;
  /** Absolute directory artifacts/acquisition/<slug>. */
  dir: string;
  /** Paths relative to the repo root (forward slashes). Missing keys = not captured. */
  files: {
    rawHtml?: string;
    renderedHtml?: string;
    screenshotDesktop?: string;
    screenshotMobile?: string;
    domSnapshot?: string;
    assetsDir?: string;
    faceliftCrawlDir?: string;
  };
  assetCount: number;
  /** Which acquisition methods succeeded, e.g. ["playwright", "facelift-crawler"]. */
  methods: string[];
  warnings: string[];
  error?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Phase 2 — design extraction (artifacts/design-tokens/<slug>/{tokens.json,extraction.json})
// ---------------------------------------------------------------------------

export interface DesignExtractionResult {
  url: string;
  slug: string;
  ok: boolean;
  extractor: "chhapify" | "default";
  /** Repo-relative path of the normalized DesignTokens JSON. */
  tokensFile: string;
  error?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Phase 3 — feature inventory (artifacts/feature-manifests/<slug>.json)
// ---------------------------------------------------------------------------

export interface FeatureInventoryResult {
  url: string;
  slug: string;
  manifestFile: string;
  usedBaseline: boolean;
  featureTypes: string[];
  analyzers: AnalyzerRun[];
}

// ---------------------------------------------------------------------------
// Phase 6 — UI generation (generated-websites/<project>/.factory/project.json)
// ---------------------------------------------------------------------------

export interface GeneratedProject {
  briefId: string;
  briefName: string;
  projectName: string;
  /** Absolute project directory. */
  dir: string;
  inspiration: { url: string | null; slug: string; extractor: "chhapify" | "default" };
  /** Repo-relative path of the json-render spec (artifacts/ui-specs/<project>.spec.json). */
  specFile: string;
  specSource: "llm" | "deterministic" | "llm+repair";
  /** Feature types rendered on the page (⊇ union). */
  featureTypes: string[];
  components: string[];
  theme: {
    strategy: string;
    mode: "light" | "dark";
    baseHue: number;
    background: string;
    foreground: string;
    primary: string;
    accent: string;
    fonts: { display: string; body: string; mono: string | null };
  };
  generatedAt: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Phase 7 — validation (artifacts/validation-reports/<project>.md + .factory/validation.json)
// ---------------------------------------------------------------------------

/** The six site-facelift validation headings, plus build-level structure checks. */
export type ValidationCategory =
  | "image-reuse"
  | "image-placement"
  | "typo"
  | "repetition"
  | "awkward-phrasing"
  | "broken"
  | "structure";

export interface ValidationIssue {
  category: ValidationCategory;
  severity: "error" | "warning" | "info";
  /** Project-relative file path. */
  file: string;
  location?: string;
  message: string;
  suggestion?: string;
  autoFixable: boolean;
  fixed?: boolean;
  /** "mechanical" (our checks) or "facelift" (parsed from site-facelift's validation.md). */
  source: "mechanical" | "facelift";
}

export interface ValidationResult {
  project: string;
  dir: string;
  issues: ValidationIssue[];
  fixedCount: number;
  facelift: { review: "ran" | "skipped" | "failed"; cleanup: "ran" | "skipped" | "failed"; detail?: string; reportFile?: string };
  /** Repo-relative path of artifacts/validation-reports/<project>.md */
  reportFile: string;
  /** False only when unfixed `error` issues remain. */
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Phase 8 — packaging (.factory/packaging.json)
// ---------------------------------------------------------------------------

export interface PackagingResult {
  project: string;
  dir: string;
  installed: boolean;
  built: boolean;
  buildAttempts: number;
  /** Human-readable auto-fixes applied to make the build pass. */
  fixesApplied: string[];
  smokeTest: "passed" | "failed" | "skipped";
  /** Repo-relative path of RUN.md. */
  runFile: string;
  /** Exact command for the user, e.g. "cd generated-websites/marisela-site-01-minimalist && npm run dev". */
  runCommand: string;
  buildLog?: string;
  error?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Planner — task graph (artifacts/task-graph.json)
// ---------------------------------------------------------------------------

export type AgentRole = "planner" | "specialist" | "coder" | "debugger" | "reviewer" | "reporter";

export interface TaskNode {
  id: string;
  phase: string;
  role: AgentRole;
  /** Module implementing the task, e.g. "src/agents/design-extractor.ts". */
  agent: string;
  title: string;
  inputs: string[];
  outputs: string[];
  dependsOn: string[];
  status: "pending" | "running" | "completed" | "degraded" | "failed" | "skipped";
}

export interface TaskGraph {
  version: 1;
  runId: string;
  createdAt: string;
  /** AgentMesh role → module mapping. */
  agentMesh: Record<"planner" | "coder" | "debugger" | "reviewer", string>;
  nodes: TaskNode[];
  edges: Array<[string, string]>;
}

// ---------------------------------------------------------------------------
// Final summary
// ---------------------------------------------------------------------------

export interface RunSummary {
  runId: string;
  durationMs: number;
  projects: Array<{
    name: string;
    dir: string;
    runCommand: string;
    built: boolean;
    smokeTest: PackagingResult["smokeTest"];
    validationPassed: boolean;
  }>;
  reportFile: string;
  warnings: string[];
}
