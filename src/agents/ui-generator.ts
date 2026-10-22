import path from "node:path";
import type { Spec } from "@json-render/core";
import fs from "fs-extra";
import pLimit from "p-limit";
import type { DesignTokens } from "../schemas/design-tokens.js";
import { buildCatalog, loadBriefManifest } from "../generators/component-registry.js";
import { toSiteContent } from "../generators/content-injector.js";
import { scaffoldProject, type ScaffoldOptions } from "../generators/nextjs-scaffold.js";
import { buildDeterministicSpec } from "../generators/spec-builder.js";
import { checkSpecCoverage, normalizeSpec, renderPageTsx } from "../generators/spec-renderer.js";
import { generateTheme, paletteDistance, type Theme } from "../generators/theme-generator.js";
import { generateSpecWithLLM } from "../tools/run-json-render.js";
import type { GeneratedProject, InspirationSite, PipelineRun } from "../types/pipeline.js";
import { resolveAutoMode, type DesignBrief, type FactoryContext } from "../utils/config.js";
import { readJsonIfExists, seededRandom, toPosixRelative, writeJson } from "../utils/file-utils.js";
import { describeLLMError, generateText, llmAvailable, llmProvider } from "../utils/llm.js";
import { isoTimestamp } from "../utils/logger.js";
import { loadContent } from "./content-synthesizer.js";
import { loadAllDesignTokens, loadDefaultTokens } from "./design-extractor.js";
import { loadUnion } from "./feature-inventory.js";

/**
 * Phase 6 — the AgentMesh "Coder". For each design brief: pick an inspiration token set, derive the
 * brief's theme, compose the page with json-render (Claude when available, deterministic otherwise),
 * normalize/validate the spec, render app/page.tsx and scaffold the Next.js project.
 */

const PHASE = "PHASE_6_UI_GENERATION" as const;

function projectFile(ctx: FactoryContext, brief: DesignBrief): string {
  return path.join(ctx.paths.outputDir, brief.projectName, ".factory", "project.json");
}

export async function loadGeneratedProjects(ctx: FactoryContext): Promise<GeneratedProject[]> {
  const out: GeneratedProject[] = [];
  for (const brief of ctx.briefs) {
    const p = await readJsonIfExists<GeneratedProject | null>(projectFile(ctx, brief), null);
    if (p) out.push(p);
  }
  return out;
}

/**
 * Reproducible "random" choice of one inspiration URL per brief: shuffle the sites that have real
 * chhapify tokens with a seeded PRNG, then deal them round-robin so different briefs draw from
 * different sites whenever possible. Falls back to the default token set.
 */
export function chooseInspiration(briefs: DesignBrief[], sites: InspirationSite[], tokensBySlug: Map<string, DesignTokens>, seed: string, defaultTokens?: DesignTokens): Map<string, DesignTokens> {
  const real = sites.map((s) => tokensBySlug.get(s.slug)).filter((t): t is DesignTokens => Boolean(t) && t!.extractor === "chhapify");
  const pool = real.length ? real : sites.map((s) => tokensBySlug.get(s.slug)).filter((t): t is DesignTokens => Boolean(t));
  const rand = seededRandom(`${seed}:${sites.map((s) => s.slug).join(",")}`);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const out = new Map<string, DesignTokens>();
  briefs.forEach((brief, i) => {
    const tokens = shuffled.length ? shuffled[i % shuffled.length] : defaultTokens;
    if (tokens) out.set(brief.id, tokens);
  });
  return out;
}

export async function generateProjects(
  run: PipelineRun,
  opts: { llm?: typeof generateText; scaffold?: (o: ScaffoldOptions) => Promise<{ files: string[] }> } = {},
): Promise<GeneratedProject[]> {
  const { ctx, checkpoint } = run;
  const log = run.logger.child("ui");
  const lang = ctx.config.siteLanguage;
  const union = await loadUnion(ctx);
  const doc = await loadContent(ctx);
  const content = toSiteContent(doc);
  const tokensBySlug = await loadAllDesignTokens(run);
  const defaultTokens = await loadDefaultTokens(ctx);
  const inspiration = chooseInspiration(ctx.briefs, run.sites, tokensBySlug, ctx.config.generation.inspirationSeed, defaultTokens);
  const jr = ctx.config.tools.jsonRender;
  const useLLM = resolveAutoMode(jr.useLLM, llmAvailable() || Boolean(opts.llm)) && (llmAvailable() || Boolean(opts.llm));
  log.info(`Phase 6: composing ${ctx.briefs.length} sites with json-render (${useLLM ? `LLM: ${opts.llm ? "injected" : llmProvider()}` : "deterministic composer"})`);
  const scaffold = opts.scaffold ?? scaffoldProject;
  // Claude composes one page per call (minutes each), so sites are generated in parallel; the
  // deterministic composer is instant either way.
  const limit = pLimit(useLLM ? ctx.config.concurrency.projects : 1);

  const generateOne = async (brief: DesignBrief): Promise<{ project: GeneratedProject; theme: Theme | null }> => {
    const existing = await readJsonIfExists<GeneratedProject | null>(projectFile(ctx, brief), null);
    if (checkpoint.isItemDone(PHASE, brief.id) && existing) {
      log.info(`${brief.projectName} already generated — skipping`);
      return { project: existing, theme: null };
    }
    await checkpoint.setItem(PHASE, brief.id, "running");
    const tokens = inspiration.get(brief.id) ?? defaultTokens;
    log.info(`Brief ${brief.name} → inspiration ${tokens.sourceUrl ?? "default token set"} (${tokens.extractor})`);
    const theme = generateTheme(brief, tokens);
    const manifest = await loadBriefManifest(ctx, brief);
    const bundle = buildCatalog({ union, brief, manifest, featureMap: ctx.featureMap, lang });
    const fallback = buildDeterministicSpec({ brief, bundle, manifest, union, content, lang });
    const warnings: string[] = [];

    let spec: Spec = fallback;
    let specSource: GeneratedProject["specSource"] = "deterministic";
    let promptLog = "Deterministic composer (no LLM available or LLM disabled). The spec was built from config/design-briefs.json and the brief manifest.";
    // Re-checked per site: a session/usage limit hit by an earlier call switches Claude off mid-run.
    if (useLLM && (opts.llm || llmAvailable())) {
      try {
        const briefPrompt = await fs.readFile(path.join(ctx.paths.root, brief.promptFile), "utf8");
        const res = await generateSpecWithLLM({
          bundle,
          brief,
          briefPrompt,
          content,
          union,
          lang,
          model: jr.model,
          effort: jr.effort,
          maxTokens: jr.maxTokens,
          maxRepairAttempts: jr.maxRepairAttempts,
          logger: log,
          llm: opts.llm,
        });
        spec = res.spec;
        specSource = res.attempts > 1 ? "llm+repair" : "llm";
        if (res.issues.length) warnings.push(...res.issues.map((i) => `LLM spec issue (auto-fixed): ${i}`));
        promptLog = `# Prompts used for ${brief.projectName}\n\n## System\n\n${res.prompts.system}\n\n## User (last attempt)\n\n${res.prompts.user}\n\n## Raw model outputs\n\n${res.rawOutputs.map((o, i) => `### Attempt ${i + 1}\n\n\`\`\`jsonl\n${o}\n\`\`\``).join("\n\n")}\n`;
      } catch (err) {
        const msg = `LLM page composition failed (${describeLLMError(err)}) — deterministic composer used`;
        log.warn(`${brief.name}: ${msg}`);
        warnings.push(msg);
      }
    }

    const normalized = normalizeSpec(spec, bundle, content, fallback);
    spec = normalized.spec;
    if (normalized.fixes.length) log.debug(`[ui] ${brief.id} spec fixes: ${normalized.fixes.join("; ")}`);
    const coverage = checkSpecCoverage(spec, bundle);
    if (coverage.missing.length) throw new Error(`Spec for ${brief.id} is missing feature types after normalization: ${coverage.missing.join(", ")}`);

    const pageTsx = renderPageTsx(spec, { content });
    const projectDir = path.join(ctx.paths.outputDir, brief.projectName);
    await scaffold({ ctx, brief, theme, tokens, doc, spec, pageTsx, projectDir, logger: log });

    const specFile = path.join(ctx.paths.uiSpecsDir, `${brief.projectName}.spec.json`);
    await writeJson(specFile, spec);
    await fs.outputFile(path.join(ctx.paths.uiSpecsDir, `${brief.projectName}.prompt.md`), promptLog, "utf8");
    await fs.outputFile(
      path.join(ctx.paths.uiSpecsDir, `${brief.projectName}.catalog-prompt.txt`),
      bundle.catalog.prompt({ customRules: brief.jsonRenderRules }),
      "utf8",
    );
    const elements = (spec as unknown as { elements: Record<string, { type: string }> }).elements;
    const project: GeneratedProject = {
      briefId: brief.id,
      briefName: brief.name,
      projectName: brief.projectName,
      dir: projectDir,
      inspiration: { url: tokens.sourceUrl, slug: tokens.slug, extractor: tokens.extractor },
      specFile: toPosixRelative(ctx.paths.root, specFile),
      specSource,
      featureTypes: coverage.present,
      components: [...new Set(Object.values(elements).map((e) => e.type).filter((t) => t !== "Page"))],
      theme: {
        strategy: theme.strategy,
        mode: theme.mode,
        baseHue: theme.baseHue,
        background: theme.palette.background,
        foreground: theme.palette.foreground,
        primary: theme.palette.primary,
        accent: theme.palette.accent,
        fonts: { display: brief.fonts.display.family, body: brief.fonts.body.family, mono: brief.fonts.mono?.family ?? null },
      },
      generatedAt: isoTimestamp(),
      warnings,
    };
    await writeJson(projectFile(ctx, brief), project);
    log.success(`Generated ${brief.projectName} (${specSource}, ${coverage.present.length} feature types, palette ${theme.palette.background}/${theme.palette.accent})`);
    await checkpoint.setItem(PHASE, brief.id, warnings.length ? "degraded" : "completed");
    return { project, theme };
  };

  const results = await Promise.all(ctx.briefs.map((brief) => limit(() => generateOne(brief))));
  const projects = results.map((r) => r.project);
  const themes = results.map((r) => r.theme).filter((t): t is Theme => t !== null);

  // Uniqueness check across the generated palettes.
  for (let i = 0; i < themes.length; i++) {
    for (let j = i + 1; j < themes.length; j++) {
      const d = paletteDistance(themes[i], themes[j]);
      if (d < 8) log.warn(`Palettes of ${themes[i].briefId} and ${themes[j].briefId} are close (ΔE ${d}) — typography and layout still differ`);
      else log.debug(`[ui] palette distance ${themes[i].briefId} ↔ ${themes[j].briefId}: ΔE ${d}`);
    }
  }
  return projects;
}
