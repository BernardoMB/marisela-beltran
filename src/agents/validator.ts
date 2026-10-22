import path from "node:path";
import type { Spec } from "@json-render/core";
import fs from "fs-extra";
import pLimit from "p-limit";
import type { ArtistContent, ImageAsset } from "../schemas/content-schema.js";
import { renderContentModule } from "../generators/content-injector.js";
import { renderReviewBundle } from "../generators/review-bundle.js";
import { renderPageTsx } from "../generators/spec-renderer.js";
import { ensureFacelift, faceliftCleanup, faceliftCleanupEnabled, faceliftReview, faceliftReviewEnabled, faceliftReviewSkipReason, parseFaceliftValidation } from "../tools/run-facelift.js";
import type { GeneratedProject, PipelineRun, ValidationCategory, ValidationIssue, ValidationResult } from "../types/pipeline.js";
import type { FactoryContext } from "../utils/config.js";
import { listFilesRecursive, readJson, readJsonIfExists, toPosixRelative, writeJson } from "../utils/file-utils.js";
import { loadUnion } from "./feature-inventory.js";

/**
 * Phase 7 — the AgentMesh "Debugger". A mechanical pass implementing site-facelift's six validation
 * headings (image reuse, image placement, typos, repetition, awkward phrasing/placeholders,
 * missing or broken things) plus structural checks, with safe auto-fixes on generated files
 * (lib/content.ts, lib/ui-spec.json → app/page.tsx). When the Claude Code CLI is available,
 * site-facelift's own AI review (VALIDATION_PROMPT) runs too and its findings are merged.
 */

const PHASE = "PHASE_7_VALIDATION" as const;

type Element = { type: string; props: Record<string, unknown>; children: string[] };
type FlatSpec = { root: string; elements: Record<string, Element> };

const HEADINGS: Array<[ValidationCategory, string]> = [
  ["image-reuse", "Image reuse"],
  ["image-placement", "Image placement"],
  ["typo", "Typos and spelling errors"],
  ["repetition", "Repetition"],
  ["awkward-phrasing", "Awkward phrasing"],
  ["broken", "Missing or broken obvious things"],
  ["structure", "Structure"],
];

// Code-style markers are matched case-sensitively: "todo" is an everyday Spanish word.
const PLACEHOLDER_EXACT = /\{(?:alias|name|debutYear)\}|\bundefined\b|\bNaN\b|\[object Object\]|\bTODO\b|\bTBD\b|\bFIXME\b/;
const PLACEHOLDER_PHRASE = /lorem ipsum|welcome to our website|bienvenidos? a nuestro sitio/i;
const isPlaceholder = (s: string) => PLACEHOLDER_EXACT.test(s) || PLACEHOLDER_PHRASE.test(s);
const MOJIBAKE = /Ã[\u0080-¿]|Â[\u0080-¿ ]|�/;
/** Folder (inside each project) holding the text rendering that site-facelift's AI review reads. */
const REVIEW_DIR = ".factory/review";

function validationFile(project: GeneratedProject): string {
  return path.join(project.dir, ".factory", "validation.json");
}

export async function loadValidationResults(ctx: FactoryContext, projects: GeneratedProject[]): Promise<ValidationResult[]> {
  const out: ValidationResult[] = [];
  for (const p of projects) {
    const r = await readJsonIfExists<ValidationResult | null>(validationFile(p), null);
    if (r) out.push(r);
  }
  void ctx;
  return out;
}

/** Parse lib/content.ts (its object literal is JSON, written by the content injector). */
export function parseContentModule(source: string): ArtistContent {
  const start = source.indexOf("=", source.indexOf("export const artistContent"));
  const body = source.slice(start + 1).trim().replace(/;\s*$/, "");
  return JSON.parse(body) as ArtistContent;
}

function fixMojibake(s: string): string {
  if (!MOJIBAKE.test(s)) return s;
  const repaired = Buffer.from(s, "latin1").toString("utf8");
  return repaired.includes("�") ? s : repaired;
}

/** Mechanical text fixes: zero-width characters, double spaces, space before punctuation, doubled words, mojibake. */
function cleanText(s: string): string {
  return fixMojibake(s)
    .replace(/[​-‍⁠﻿]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])(?=\s|$)/g, "$1")
    .replace(/\b(\p{L}{2,})\s+\1\b/giu, "$1");
}

/** Walk every string in a JSON-like value, optionally replacing it. */
function mapStrings(value: unknown, fn: (s: string, at: string) => string, at = ""): unknown {
  if (typeof value === "string") return fn(value, at);
  if (Array.isArray(value)) return value.map((v, i) => mapStrings(v, fn, `${at}/${i}`));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = k === "$state" || k === "href" || k === "src" || k === "url" || k === "previewUrl" || k === "sourceUrl" ? v : mapStrings(v, fn, `${at}/${k}`);
    return out;
  }
  return value;
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 50);
}

async function validateProject(run: PipelineRun, project: GeneratedProject, unionTypes: string[]): Promise<ValidationResult> {
  const { ctx } = run;
  const log = run.logger.child("validate");
  const dir = project.dir;
  const issues: ValidationIssue[] = [];
  const add = (i: Omit<ValidationIssue, "source"> & { source?: ValidationIssue["source"] }) => issues.push({ source: "mechanical", ...i });

  const contentPath = path.join(dir, "lib", "content.ts");
  const specPath = path.join(dir, "lib", "ui-spec.json");
  let content = parseContentModule(await fs.readFile(contentPath, "utf8"));
  let spec = await readJson<FlatSpec>(specPath);
  let contentChanged = false;
  let specChanged = false;
  const pageTsx = await fs.readFile(path.join(dir, "app", "page.tsx"), "utf8");
  const layoutTsx = await fs.readFile(path.join(dir, "app", "layout.tsx"), "utf8");

  // --- Image reuse ---------------------------------------------------------
  const hero = content.images.hero;
  if (hero && !hero.placeholder) {
    // The Biography component shows images.portrait (biography.image mirrors it).
    if (content.images.portrait?.src === hero.src || content.biography.image?.src === hero.src) {
      const alternative = content.images.gallery.find((g) => g.src !== hero.src);
      if (alternative) {
        content.images.portrait = alternative;
        content.biography.image = alternative;
        contentChanged = true;
      }
      add({
        category: "image-reuse",
        severity: alternative ? "warning" : "info",
        file: "lib/content.ts",
        location: "images.portrait",
        message: `The hero photo (${hero.src}) is also the biography portrait.`,
        suggestion: alternative ? `Used ${alternative.src} for the biography instead.` : "Add a second licensed photo to public/images and set images.portrait in lib/content.ts.",
        autoFixable: Boolean(alternative),
        fixed: Boolean(alternative),
      });
    }
    const others = content.images.gallery.filter((g) => g.src !== hero.src);
    if (others.length >= 2 && others.length < content.images.gallery.length) {
      content.images.gallery = others;
      contentChanged = true;
      add({ category: "image-reuse", severity: "warning", file: "lib/content.ts", location: "images.gallery", message: "The hero photo also appeared in the photo gallery.", suggestion: "Removed it from the gallery (other photos remain).", autoFixable: true, fixed: true });
    } else if (content.images.gallery.length === 1 && content.images.gallery[0].src === hero.src) {
      add({ category: "image-reuse", severity: "info", file: "lib/content.ts", location: "images.gallery", message: "Only one freely licensed photo exists, so the gallery repeats the hero photo.", suggestion: "Add more licensed photos to public/images/gallery and lib/content.ts.", autoFixable: false });
    }
  }
  const coverSrcs = content.discography.map((a) => a.cover?.src).filter((s): s is string => Boolean(s));
  const dupCovers = coverSrcs.filter((s, i) => coverSrcs.indexOf(s) !== i && !s.includes("/placeholders/"));
  if (dupCovers.length) add({ category: "image-reuse", severity: "warning", file: "lib/content.ts", location: "discography", message: `Album cover file used by more than one album: ${[...new Set(dupCovers)].join(", ")}`, autoFixable: false });

  // --- Image placement & missing files -------------------------------------
  const images: Array<[string, ImageAsset | undefined]> = [
    ["images.hero", content.images.hero],
    ["images.portrait", content.images.portrait],
    ["biography.image", content.biography.image],
    ...content.images.gallery.map((g, i) => [`images.gallery[${i}]`, g] as [string, ImageAsset]),
    ...content.discography.map((a, i) => [`discography[${i}].cover`, a.cover] as [string, ImageAsset | undefined]),
  ];
  for (const [where, img] of images) {
    if (!img) continue;
    if (!/^https?:/i.test(img.src) && !(await fs.pathExists(path.join(dir, "public", img.src.replace(/^\//, ""))))) {
      add({ category: "broken", severity: "error", file: "lib/content.ts", location: where, message: `Image file not found: public${img.src}`, suggestion: "Remove the reference or add the file.", autoFixable: false });
    }
    if (!img.placeholder && !img.alt.trim()) {
      add({ category: "image-placement", severity: "error", file: "lib/content.ts", location: where, message: "Image without alt text.", suggestion: `Describe the image (e.g. "${content.name}").`, autoFixable: true, fixed: true });
      img.alt = content.name;
      contentChanged = true;
    } else if (/\.(jpe?g|png|webp|svg)$/i.test(img.alt)) {
      add({ category: "image-placement", severity: "warning", file: "lib/content.ts", location: where, message: `Alt text looks like a file name: "${img.alt}"`, autoFixable: false });
    }
  }

  // --- Typos / awkward phrasing / placeholders (content + page copy) -------
  const fixStrings = (value: unknown, file: string): unknown =>
    mapStrings(value, (s, at) => {
      let out = s;
      if (MOJIBAKE.test(out)) {
        const repaired = fixMojibake(out);
        add({ category: "typo", severity: "error", file, location: at, message: `Encoding damage (mojibake): "${out.slice(0, 60)}"`, autoFixable: repaired !== out, fixed: repaired !== out });
        out = repaired;
      }
      const cleaned = cleanText(out);
      if (cleaned !== out) {
        add({ category: "typo", severity: "info", file, location: at, message: `Spacing/doubled-word fix: "${out.slice(0, 60)}" → "${cleaned.slice(0, 60)}"`, autoFixable: true, fixed: true });
        out = cleaned;
      }
      if (isPlaceholder(out)) {
        const stripped = out.replace(/\s*·?\s*\{(?:alias|name|debutYear)\}\s*·?\s*/g, " ").replace(/\s{2,}/g, " ").trim();
        const fixedPlaceholder = stripped !== out && !isPlaceholder(stripped);
        add({ category: "awkward-phrasing", severity: "error", file, location: at, message: `Leftover placeholder text: "${out.slice(0, 80)}"`, suggestion: "Replace with real copy.", autoFixable: fixedPlaceholder, fixed: fixedPlaceholder });
        if (fixedPlaceholder) out = stripped;
      }
      return out;
    });
  const newContent = fixStrings(content, "lib/content.ts") as ArtistContent;
  if (JSON.stringify(newContent) !== JSON.stringify(content)) {
    content = newContent;
    contentChanged = true;
  }
  const newSpec = fixStrings(spec, "lib/ui-spec.json") as FlatSpec;
  if (JSON.stringify(newSpec) !== JSON.stringify(spec)) {
    spec = newSpec;
    specChanged = true;
  }

  // --- Repetition ----------------------------------------------------------
  const seen = new Map<string, string>();
  const visible: Array<[string, string]> = [];
  for (const [key, el] of Object.entries(spec.elements)) {
    for (const [prop, v] of Object.entries(el.props)) if (typeof v === "string" && !/^(#|https?:)/.test(v)) visible.push([`${el.type}.${prop} (${key})`, v]);
  }
  content.biography.paragraphs.forEach((p, i) => visible.push([`biography.paragraphs[${i}]`, p]));
  for (const [where, text] of visible) {
    for (const s of sentences(text)) {
      const prev = seen.get(s);
      if (prev && prev !== where) add({ category: "repetition", severity: "info", file: "lib/ui-spec.json", location: `${prev} ↔ ${where}`, message: `Sentence appears twice: "${s.slice(0, 90)}…"`, autoFixable: false });
      else seen.set(s, where);
    }
  }

  // --- Missing or broken: anchors, links, metadata, components --------------
  const anchors = new Set(Object.values(spec.elements).map((e) => e.props.anchorId).filter((a): a is string => typeof a === "string"));
  const linkProps = ["links", "cta", "primaryCta", "secondaryCta"];
  for (const el of Object.values(spec.elements)) {
    for (const lp of linkProps) {
      const v = el.props[lp];
      const list = Array.isArray(v) ? v : v ? [v] : [];
      const kept = list.filter((l) => {
        const href = String((l as { href?: unknown }).href ?? "");
        if (href === "#" || (href.startsWith("#") && !anchors.has(href.slice(1)))) {
          add({ category: "broken", severity: "error", file: "lib/ui-spec.json", location: `${el.type}.${lp}`, message: `Link "${href}" points to a section that does not exist.`, suggestion: "Removed the link.", autoFixable: true, fixed: true });
          return false;
        }
        if (href && !/^(#|\/|https?:|mailto:|tel:)/.test(href)) add({ category: "broken", severity: "warning", file: "lib/ui-spec.json", location: `${el.type}.${lp}`, message: `Unusual link target "${href}".`, autoFixable: false });
        return true;
      });
      if (kept.length !== list.length) {
        el.props[lp] = Array.isArray(v) ? kept : kept[0];
        if (!Array.isArray(v) && !kept.length) delete el.props[lp];
        specChanged = true;
      }
    }
  }
  if (!/export const metadata/.test(layoutTsx)) add({ category: "broken", severity: "error", file: "app/layout.tsx", message: "Page metadata (title/description) is missing.", autoFixable: false });
  const imported = [...pageTsx.matchAll(/from "@\/components\/([\w/]+)"/g)].map((m) => m[1]);
  for (const name of imported) {
    if (!(await fs.pathExists(path.join(dir, "components", `${name}.tsx`)))) add({ category: "structure", severity: "error", file: "app/page.tsx", message: `Imported component components/${name}.tsx does not exist.`, autoFixable: false });
  }
  for (const file of await listFilesRecursive(path.join(dir, "components"), (f) => f.endsWith(".tsx"))) {
    const src = await fs.readFile(file, "utf8");
    // Comments can mention "<img>" or "TODO" in prose (e.g. a JSDoc line documenting an <img> prop);
    // strip them before scanning for real JSX/code so that prose doesn't register as a code issue.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(?<!:)\/\/.*$/gm, " ");
    const rel = toPosixRelative(dir, file);
    if (/href=["']#["']/.test(code)) add({ category: "broken", severity: "warning", file: rel, message: 'Link with href="#".', autoFixable: false });
    if (/<img(?![^>]*\balt=)[^>]*>/s.test(code)) add({ category: "image-placement", severity: "warning", file: rel, message: "<img> without an alt attribute.", autoFixable: false });
    if (/lorem ipsum/i.test(code) || /\bTODO\b|\bFIXME\b/.test(code)) add({ category: "awkward-phrasing", severity: "warning", file: rel, message: "Placeholder text (Lorem ipsum / TODO) in a component.", autoFixable: false });
  }
  const footer = Object.values(spec.elements).find((e) => e.type === "Footer");
  if (footer && !String(footer.props.copyright ?? "").includes(String(new Date().getFullYear()))) {
    add({ category: "broken", severity: "info", file: "lib/ui-spec.json", location: "Footer.copyright", message: "Copyright year is not the current year.", autoFixable: false });
  }

  // --- Structure: feature union coverage --------------------------------------
  const present = new Set(project.featureTypes);
  for (const t of unionTypes) {
    if (!present.has(t)) add({ category: "structure", severity: "error", file: "lib/ui-spec.json", message: `Feature "${t}" from the inspiration sites is missing on this site.`, autoFixable: false });
  }

  // --- Apply fixes ------------------------------------------------------------
  if (contentChanged) await fs.writeFile(contentPath, renderContentModule(content), "utf8");
  if (specChanged || contentChanged) {
    await writeJson(specPath, spec);
    await fs.writeFile(path.join(dir, "app", "page.tsx"), renderPageTsx(spec as unknown as Spec, { content }), "utf8");
  }

  // --- site-facelift AI review --------------------------------------------------
  // The review reads a text rendering of the page (what visitors see), not the project sources.
  await fs.outputFile(path.join(dir, REVIEW_DIR, "page.md"), renderReviewBundle({ spec, content, projectName: project.projectName, briefName: project.briefName }), "utf8");
  const facelift: ValidationResult["facelift"] = { review: "skipped", cleanup: "skipped" };
  const env = await ensureFacelift(ctx, log);
  if (!faceliftReviewEnabled(ctx, env)) {
    facelift.detail = faceliftReviewSkipReason(ctx, env);
  } else if (env) {
    const reportPath = path.join(dir, ".factory", "facelift-validation.md");
    const { model, effort } = ctx.config.tools.facelift;
    log.info(`site-facelift: AI review of ${project.projectName} (Claude Code${model ? `, ${model}` : ""}${effort ? `, effort ${effort}` : ""})`);
    const review = await faceliftReview({ ctx, env, projectDir: dir, siteDir: REVIEW_DIR, reportPath, logger: log });
    facelift.review = review.status;
    facelift.detail = review.detail;
    if (review.status === "ran" && review.reportPath) {
      facelift.reportFile = toPosixRelative(ctx.paths.root, review.reportPath);
      issues.push(...parseFaceliftValidation(await fs.readFile(review.reportPath, "utf8")));
      if (faceliftCleanupEnabled(ctx, env)) {
        const cleanup = await faceliftCleanup({ ctx, env, projectDir: dir, reportPath, deferredPath: path.join(dir, ".factory", "facelift-deferred-decisions.md"), logger: log });
        facelift.cleanup = cleanup.status;
      }
    }
  }

  const fixedCount = issues.filter((i) => i.fixed).length;
  const passed = !issues.some((i) => i.severity === "error" && !i.fixed);
  const reportFile = path.join(ctx.paths.validationReportsDir, `${project.projectName}.md`);
  await fs.outputFile(reportFile, renderReport(project, issues, facelift, passed), "utf8");
  const result: ValidationResult = { project: project.projectName, dir, issues, fixedCount, facelift, reportFile: toPosixRelative(ctx.paths.root, reportFile), passed };
  await writeJson(validationFile(project), result);
  return result;
}

function renderReport(project: GeneratedProject, issues: ValidationIssue[], facelift: ValidationResult["facelift"], passed: boolean): string {
  const lines = [
    `# Validation report — ${project.projectName}`,
    "",
    `**Result:** ${passed ? "PASSED" : "NEEDS ATTENTION"} · ${issues.length} findings · ${issues.filter((i) => i.fixed).length} fixed automatically`,
    `**site-facelift AI review:** ${facelift.review}${facelift.detail ? ` (${facelift.detail})` : ""}${facelift.reportFile ? ` — full report: \`${facelift.reportFile}\`` : ""}`,
    "",
    "| Category | Errors | Warnings | Info | Fixed |",
    "|---|---|---|---|---|",
    ...HEADINGS.map(([cat, title]) => {
      const list = issues.filter((i) => i.category === cat);
      return `| ${title} | ${list.filter((i) => i.severity === "error").length} | ${list.filter((i) => i.severity === "warning").length} | ${list.filter((i) => i.severity === "info").length} | ${list.filter((i) => i.fixed).length} |`;
    }),
    "",
  ];
  for (const [cat, title] of HEADINGS) {
    lines.push(`## ${title}`, "");
    const list = issues.filter((i) => i.category === cat);
    if (!list.length) {
      lines.push("None.", "");
      continue;
    }
    for (const i of list) {
      lines.push(
        `- **${i.severity}**${i.fixed ? " (fixed)" : ""} — \`${i.file}\`${i.location ? ` · ${i.location}` : ""}: ${i.message}${i.suggestion ? ` *Suggested fix:* ${i.suggestion}` : ""}${i.source === "facelift" ? " _(site-facelift)_" : ""}`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export async function validateProjects(run: PipelineRun, projects: GeneratedProject[]): Promise<ValidationResult[]> {
  const { ctx, checkpoint } = run;
  const log = run.logger.child("validate");
  const union = await loadUnion(ctx).catch(() => null);
  // Projects are validated in parallel only to overlap the (slow) Claude reviews; the mechanical pass is quick.
  const limit = pLimit(ctx.config.concurrency.reviews);
  const results = await Promise.all(
    projects.map((project) =>
      limit(async (): Promise<ValidationResult | null> => {
        const existing = await readJsonIfExists<ValidationResult | null>(validationFile(project), null);
        if (checkpoint.isItemDone(PHASE, project.projectName) && existing) return existing;
        await checkpoint.setItem(PHASE, project.projectName, "running");
        log.info(`Phase 7: Validating ${project.projectName}`);
        try {
          const r = await validateProject(run, project, union?.featureTypes ?? []);
          const errors = r.issues.filter((i) => i.severity === "error" && !i.fixed).length;
          if (r.passed) log.success(`${project.projectName}: validation passed (${r.issues.length} findings, ${r.fixedCount} auto-fixed)`);
          else log.warn(`${project.projectName}: ${errors} unresolved error(s) — see ${r.reportFile}`);
          await checkpoint.setItem(PHASE, project.projectName, r.passed ? "completed" : "degraded");
          return r;
        } catch (err) {
          log.error(`Validation of ${project.projectName} crashed`, err);
          await checkpoint.setItem(PHASE, project.projectName, "failed", err instanceof Error ? err.message : String(err));
          return null;
        }
      }),
    ),
  );
  return results.filter((r): r is ValidationResult => r !== null);
}
