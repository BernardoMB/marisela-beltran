import path from "node:path";
import fs from "fs-extra";
import pLimit from "p-limit";
import { DesignTokensSchema, type DesignTokens } from "../schemas/design-tokens.js";
import { parseChhapifyOutputs, runChhapify } from "../tools/run-chhapify.js";
import type { DesignExtractionResult, InspirationSite, PipelineRun } from "../types/pipeline.js";
import type { FactoryContext } from "../utils/config.js";
import { readJson, readJsonIfExists, toPosixRelative, writeJson } from "../utils/file-utils.js";
import { isoTimestamp } from "../utils/logger.js";

/**
 * Phase 2 — extract a complete design system from every inspirational URL with chhapify.
 * Output per URL: artifacts/design-tokens/<slug>/ (all chhapify files + tokens.json + extraction.json).
 * Failures fall back to config/default-design-tokens.json (item marked "degraded").
 */

const PHASE = "PHASE_2_DESIGN_EXTRACTION" as const;

function siteDir(ctx: FactoryContext, slug: string): string {
  return path.join(ctx.paths.designTokensDir, slug);
}

export async function loadDefaultTokens(ctx: FactoryContext): Promise<DesignTokens> {
  const data = await readJson<Record<string, unknown>>(path.join(ctx.paths.configDir, "default-design-tokens.json"));
  delete data.$comment;
  return DesignTokensSchema.parse(data);
}

async function defaultTokensFor(ctx: FactoryContext, site: InspirationSite, reason: string): Promise<DesignTokens> {
  const base = await loadDefaultTokens(ctx);
  return { ...base, slug: site.slug, sourceUrl: site.url, extractedAt: isoTimestamp(), warnings: [...base.warnings, reason] };
}

export async function loadDesignTokensForSite(ctx: FactoryContext, site: InspirationSite): Promise<DesignTokens> {
  const file = path.join(siteDir(ctx, site.slug), "tokens.json");
  if (await fs.pathExists(file)) {
    const parsed = DesignTokensSchema.safeParse(await readJson(file));
    if (parsed.success) return parsed.data;
  }
  return defaultTokensFor(ctx, site, "tokens.json missing — default token set used");
}

export async function loadAllDesignTokens(run: PipelineRun): Promise<Map<string, DesignTokens>> {
  const out = new Map<string, DesignTokens>();
  for (const site of run.sites) out.set(site.slug, await loadDesignTokensForSite(run.ctx, site));
  return out;
}

export async function extractDesignSystems(run: PipelineRun): Promise<DesignExtractionResult[]> {
  const { ctx, checkpoint } = run;
  const log = run.logger.child("design");
  const cfg = ctx.config.tools.chhapify;
  const limit = pLimit(ctx.config.concurrency.urls);

  return Promise.all(
    run.sites.map((site) =>
      limit(async (): Promise<DesignExtractionResult> => {
        const dir = siteDir(ctx, site.slug);
        const tokensFile = path.join(dir, "tokens.json");
        const extractionFile = path.join(dir, "extraction.json");
        if (checkpoint.isItemDone(PHASE, site.slug) && (await fs.pathExists(tokensFile))) {
          const previous = await readJsonIfExists<DesignExtractionResult | null>(extractionFile, null);
          if (previous) {
            log.info(`${site.url} already extracted — skipping`);
            return previous;
          }
        }
        await checkpoint.setItem(PHASE, site.slug, "running");
        log.info(`Phase 2: Extracting design system from ${site.url}`);
        const started = Date.now();
        let tokens: DesignTokens | null = null;
        let error: string | undefined;

        if (cfg.enabled) {
          await fs.emptyDir(dir);
          const attempts = cfg.args.includes("--full") ? [cfg.args, cfg.args.filter((a) => a !== "--full")] : [cfg.args];
          for (const [i, extraArgs] of attempts.entries()) {
            const res = await runChhapify({
              url: site.url,
              outDir: dir,
              name: site.slug,
              extraArgs,
              timeoutMs: cfg.timeoutMs,
              root: ctx.paths.root,
              logger: log,
            });
            if (res.ok) {
              try {
                tokens = await parseChhapifyOutputs({ outDir: dir, name: site.slug, url: site.url, slug: site.slug, root: ctx.paths.root, output: res.output });
                break;
              } catch (err) {
                error = `could not parse chhapify output: ${err instanceof Error ? err.message : String(err)}`;
              }
            } else {
              error = res.error;
              if (i === 0 && attempts.length > 1) log.warn(`chhapify --full failed for ${site.url} (${res.error}); retrying without --full`);
            }
          }
        } else {
          error = "chhapify disabled in config";
        }

        let ok = true;
        if (!tokens) {
          ok = false;
          log.warn(`Design extraction failed for ${site.url}: ${error ?? "unknown"} — using the default token set`);
          tokens = await defaultTokensFor(ctx, site, `chhapify failed: ${error ?? "unknown"}`);
        }
        await writeJson(tokensFile, tokens);
        const result: DesignExtractionResult = {
          url: site.url,
          slug: site.slug,
          ok,
          extractor: tokens.extractor,
          tokensFile: toPosixRelative(ctx.paths.root, tokensFile),
          error: ok ? undefined : error,
          durationMs: Date.now() - started,
        };
        await writeJson(extractionFile, result);
        if (ok) {
          log.success(
            `Design tokens written to ${toPosixRelative(ctx.paths.root, dir)}/ (primary ${tokens.colors.primary ?? "n/a"}, fonts ${tokens.typography.families.slice(0, 3).join(", ") || "n/a"})`,
          );
        }
        await checkpoint.setItem(PHASE, site.slug, ok ? "completed" : "degraded", error);
        return result;
      }),
    ),
  );
}
