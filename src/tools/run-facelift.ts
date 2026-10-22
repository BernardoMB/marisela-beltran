import path from "node:path";
import fs from "fs-extra";
import type { ValidationCategory, ValidationIssue } from "../types/pipeline.js";
import { resolveAutoMode, type FactoryContext } from "../utils/config.js";
import { isClaudeUnavailableText, llmAvailable, llmExhaustedReason, markLLMExhausted, nestedClaudeEnv } from "../utils/llm.js";
import type { Logger } from "../utils/logger.js";
import { commandExists, isWindows, run } from "../utils/shell.js";

/**
 * Wrapper for site-facelift (PyPI). It is installed into vendor/facelift-venv on first use and
 * driven through scripts/facelift_bridge.py (its CLI has no validate subcommand):
 *   - crawl:    bounded crawl with facelift.crawler (phase 1)
 *   - review:   facelift's VALIDATION_PROMPT via its Claude runner (phase 7, needs the `claude` CLI)
 *   - cleanup:  facelift's CLEANUP_PROMPT (opt-in; applies obvious fixes, logs judgment calls)
 * Every function degrades gracefully and never throws for tool failures.
 */

export interface FaceliftEnv {
  python: string;
  venvDir: string;
  version: string;
  claudeAvailable: boolean;
}

let envPromise: Promise<FaceliftEnv | null> | null = null;

function bridgePath(ctx: FactoryContext): string {
  return path.join(ctx.paths.scriptsDir, "facelift_bridge.py");
}

/**
 * Python arguments for a bridge call. `-I` isolates the venv from the user's site-packages and
 * PYTHON* variables; `-X utf8` is needed on Windows, where facelift's Claude runner otherwise decodes
 * Claude's output with the ANSI code page and crashes on the first non-ASCII character.
 */
function bridgeArgs(ctx: FactoryContext, ...rest: string[]): string[] {
  return ["-I", "-X", "utf8", bridgePath(ctx), ...rest];
}

/** Environment for a bridge call that launches `claude`: clean of parent-session markers, explicit model and effort. */
function claudeEnv(ctx: FactoryContext): Record<string, string | undefined> {
  const { model, effort } = ctx.config.tools.facelift;
  return nestedClaudeEnv({ ANTHROPIC_MODEL: model || undefined, CLAUDE_EFFORT: effort || undefined });
}

/** After a failed Claude run: if it hit a session/usage limit or an auth problem, stop all Claude use. */
function checkUnavailable(output: string, logger: Logger): string | null {
  const tail = output.slice(-4000);
  if (!isClaudeUnavailableText(tail)) return null;
  const line =
    tail
      .split(/\r?\n/)
      .reverse()
      .find((l) => isClaudeUnavailableText(l))
      ?.replace(/^.*\[claude\]\s*/, "")
      .trim() ?? "Claude limit reached";
  markLLMExhausted(line.slice(0, 160), logger);
  return line;
}

function lastJson(output: string): Record<string, unknown> | null {
  const lines = output.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("{") && l.endsWith("}"));
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]) as Record<string, unknown>;
    } catch {
      // keep looking
    }
  }
  return null;
}

async function findPython(logger: Logger): Promise<{ cmd: string; args: string[] } | null> {
  const candidates: Array<{ cmd: string; args: string[] }> = isWindows
    ? [{ cmd: "python", args: [] }, { cmd: "py", args: ["-3"] }, { cmd: "python3", args: [] }]
    : [{ cmd: "python3", args: [] }, { cmd: "python", args: [] }];
  for (const c of candidates) {
    const res = await run(c.cmd, [...c.args, "-c", "import sys; print('%d.%d' % sys.version_info[:2])"], { quiet: true, logger, timeoutMs: 20_000 });
    const m = res.stdout.trim().match(/^(\d+)\.(\d+)$/);
    if (!res.failed && m && (Number(m[1]) > 3 || (Number(m[1]) === 3 && Number(m[2]) >= 10))) return c;
  }
  return null;
}

/** Create/reuse the venv with site-facelift installed. Memoized per process. */
export function ensureFacelift(ctx: FactoryContext, logger: Logger): Promise<FaceliftEnv | null> {
  envPromise ??= ensureImpl(ctx, logger).catch((err: unknown) => {
    logger.warn("site-facelift setup failed", err);
    return null;
  });
  return envPromise;
}

async function ensureImpl(ctx: FactoryContext, logger: Logger): Promise<FaceliftEnv | null> {
  const cfg = ctx.config.tools.facelift;
  if (!cfg.enabled) return null;
  const venvDir = path.join(ctx.paths.vendorDir, "facelift-venv");
  const python = isWindows ? path.join(venvDir, "Scripts", "python.exe") : path.join(venvDir, "bin", "python");
  const marker = path.join(venvDir, ".factory-installed");
  const claudeAvailable = await commandExists("claude");

  const installed = (await fs.pathExists(marker)) && (await fs.readFile(marker, "utf8")).trim() === cfg.version && (await fs.pathExists(python));
  if (!installed) {
    const sys = await findPython(logger);
    if (!sys) {
      logger.warn("site-facelift unavailable: Python 3.10+ not found on PATH (the built-in validator still runs)");
      return null;
    }
    logger.info(`site-facelift: creating virtual environment (one time) in ${path.relative(ctx.paths.root, venvDir)}`);
    await fs.remove(venvDir);
    const venv = await run(sys.cmd, [...sys.args, "-m", "venv", venvDir], { logger, label: "python:venv", timeoutMs: 180_000 });
    if (venv.failed) {
      logger.warn(`site-facelift unavailable: could not create a venv (${venv.all.split("\n").slice(-1)[0]})`);
      return null;
    }
    const pip = await run(python, ["-m", "pip", "install", "--disable-pip-version-check", "--no-input", "-q", `site-facelift==${cfg.version}`], {
      logger,
      label: "pip:site-facelift",
      timeoutMs: 600_000,
    });
    if (pip.failed) {
      logger.warn(`site-facelift unavailable: pip install failed (${pip.all.split("\n").filter(Boolean).slice(-1)[0] ?? "unknown error"})`);
      return null;
    }
    await fs.writeFile(marker, cfg.version, "utf8");
  }
  const self = await run(python, bridgeArgs(ctx, "selftest"), { logger, label: "facelift", timeoutMs: 60_000, quiet: true });
  const info = lastJson(self.stdout);
  if (!info?.ok) {
    logger.warn(`site-facelift selftest failed: ${String(info?.error ?? self.all.slice(-300))}`);
    return null;
  }
  logger.debug(`[facelift] ready: site-facelift ${String(info.version)} (claude CLI ${claudeAvailable ? "available" : "not found"})`);
  return { python, venvDir, version: String(info.version), claudeAvailable };
}

export async function faceliftCrawl(opts: { ctx: FactoryContext; url: string; destDir: string; maxPages: number; maxAssets: number; logger: Logger }): Promise<{ ok: boolean; files: number; error?: string }> {
  const env = await ensureFacelift(opts.ctx, opts.logger);
  if (!env) return { ok: false, files: 0, error: "site-facelift unavailable" };
  const res = await run(
    env.python,
    bridgeArgs(opts.ctx, "crawl", "--url", opts.url, "--dest", opts.destDir, "--max-pages", String(opts.maxPages), "--max-assets", String(opts.maxAssets), "--delay", "0.3"),
    { logger: opts.logger, label: "facelift:crawl", timeoutMs: 240_000, quiet: true },
  );
  const out = lastJson(res.stdout);
  if (!out) return { ok: false, files: 0, error: res.timedOut ? "timed out" : "no output from the crawler" };
  return { ok: Boolean(out.ok), files: Number(out.files ?? 0), error: out.ok ? undefined : String(out.error ?? "crawl failed") };
}

function modeFor(ctx: FactoryContext, key: "aiReview" | "aiCleanup"): boolean | "auto" {
  const envValue = key === "aiReview" ? ctx.env.faceliftAiReview : ctx.env.faceliftAiCleanup;
  const value = (envValue ?? ctx.config.tools.facelift[key]) as string | boolean;
  if (value === true || value === "on") return true;
  if (value === false || value === "off") return false;
  return "auto";
}

/** Claude reviews need the CLI and an active LLM (off with --no-ai, llm.provider "off", or after a limit/auth failure). */
export function faceliftReviewEnabled(ctx: FactoryContext, env: FaceliftEnv | null): boolean {
  if (!env || !llmAvailable()) return false;
  return resolveAutoMode(modeFor(ctx, "aiReview"), env.claudeAvailable) && env.claudeAvailable;
}

export function faceliftCleanupEnabled(ctx: FactoryContext, env: FaceliftEnv | null): boolean {
  if (!env || !llmAvailable()) return false;
  const m = modeFor(ctx, "aiCleanup");
  return m === true && env.claudeAvailable;
}

/** Why the AI review is not running for this project (for reports). */
export function faceliftReviewSkipReason(ctx: FactoryContext, env: FaceliftEnv | null): string {
  if (!env) return "site-facelift unavailable (Python 3.10+ required)";
  if (ctx.flags.noAi) return "AI disabled (--no-ai)";
  const exhausted = llmExhaustedReason();
  if (exhausted) return `Claude unavailable: ${exhausted}`;
  if (!llmAvailable()) return "AI disabled (llm.provider)";
  if (!env.claudeAvailable) return "Claude Code CLI not found";
  return "AI review disabled in config (tools.facelift.aiReview)";
}

/**
 * site-facelift's AI review (VALIDATION_PROMPT through its Claude runner). `siteDir` is the folder
 * Claude reviews, relative to the project: the factory passes a compact text rendering of the page
 * (`.factory/review/`), so the review reads one file instead of exploring the whole Next.js project.
 */
export async function faceliftReview(opts: {
  ctx: FactoryContext;
  env: FaceliftEnv;
  projectDir: string;
  siteDir: string;
  reportPath: string;
  logger: Logger;
  dryRun?: boolean;
}): Promise<{ status: "ran" | "skipped" | "failed"; reportPath?: string; detail?: string; prompt?: string }> {
  const rel = path.relative(opts.projectDir, opts.reportPath).split(path.sep).join("/");
  await fs.ensureDir(path.dirname(opts.reportPath));
  await fs.remove(opts.reportPath);
  const args = bridgeArgs(opts.ctx, "validate", "--run-root", opts.projectDir, "--site-dir", opts.siteDir, "--report", rel);
  if (opts.dryRun) args.push("--dry-run");
  const res = await run(opts.env.python, args, {
    logger: opts.logger,
    label: "facelift:validate",
    timeoutMs: opts.ctx.config.tools.facelift.timeoutMs,
    cwd: opts.projectDir,
    env: claudeEnv(opts.ctx),
  });
  const out = lastJson(res.stdout);
  if (opts.dryRun) return { status: "skipped", detail: "dry run", prompt: typeof out?.prompt === "string" ? out.prompt : undefined };
  if (out?.ok && (await fs.pathExists(opts.reportPath))) return { status: "ran", reportPath: opts.reportPath };
  const limit = checkUnavailable(res.all, opts.logger);
  return { status: "failed", detail: limit ? `Claude unavailable: ${limit}` : String(out?.error ?? (res.timedOut ? "timed out" : "no report produced")) };
}

export async function faceliftCleanup(opts: { ctx: FactoryContext; env: FaceliftEnv; projectDir: string; reportPath: string; deferredPath: string; logger: Logger; dryRun?: boolean }): Promise<{ status: "ran" | "skipped" | "failed"; detail?: string }> {
  const rel = (p: string) => path.relative(opts.projectDir, p).split(path.sep).join("/");
  const args = bridgeArgs(opts.ctx, "cleanup", "--run-root", opts.projectDir, "--site-dir", ".", "--report", rel(opts.reportPath), "--deferred", rel(opts.deferredPath));
  if (opts.dryRun) args.push("--dry-run");
  const res = await run(opts.env.python, args, {
    logger: opts.logger,
    label: "facelift:cleanup",
    timeoutMs: opts.ctx.config.tools.facelift.timeoutMs,
    cwd: opts.projectDir,
    env: claudeEnv(opts.ctx),
  });
  const out = lastJson(res.stdout);
  if (opts.dryRun) return { status: "skipped", detail: "dry run" };
  if (out?.ok) return { status: "ran" };
  const limit = checkUnavailable(res.all, opts.logger);
  return { status: "failed", detail: limit ? `Claude unavailable: ${limit}` : String(out?.error ?? "cleanup failed") };
}

const HEADING_CATEGORY: Array<[RegExp, ValidationCategory]> = [
  [/image reuse/i, "image-reuse"],
  [/image placement/i, "image-placement"],
  [/typo|spelling/i, "typo"],
  [/repetition/i, "repetition"],
  [/awkward/i, "awkward-phrasing"],
  [/missing|broken/i, "broken"],
];

/** Parse facelift's validation.md (six headings, bullet findings, "None." for empty sections). */
export function parseFaceliftValidation(markdown: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let category: ValidationCategory | null = null;
  let current: ValidationIssue | null = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = line.match(/^#{1,4}\s*(?:\d+[.)]\s*)?(.+)$/);
    if (heading) {
      category = HEADING_CATEGORY.find(([re]) => re.test(heading[1]))?.[1] ?? category;
      current = null;
      continue;
    }
    if (!category || !line || /^none\.?$/i.test(line)) continue;
    const bullet = line.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      const text = bullet[1];
      const file = text.match(/`([^`]+\.(?:tsx?|css|md|json|svg|png|jpe?g))`/)?.[1] ?? text.match(/\b((?:app|components|lib|public)\/[\w./-]+)/)?.[1] ?? "";
      const fix = text.match(/(?:suggested fix|fix|suggestion)\s*[:—-]\s*(.+)$/i)?.[1];
      current = { category, severity: "warning", file, message: text.replace(/\*\*/g, "").slice(0, 500), suggestion: fix, autoFixable: false, source: "facelift" };
      issues.push(current);
    } else if (current && /^(?:suggested fix|fix|suggestion)/i.test(line)) {
      current.suggestion = line.replace(/^(?:suggested fix|fix|suggestion)\s*[:—-]?\s*/i, "");
    }
  }
  return issues;
}
