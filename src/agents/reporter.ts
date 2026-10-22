import path from "node:path";
import fs from "fs-extra";
import type { ContentDocument } from "../schemas/content-schema.js";
import type { DesignTokens } from "../schemas/design-tokens.js";
import type { FeatureManifest, UnionManifest } from "../schemas/feature-manifest.js";
import { PHASES } from "../utils/checkpoint.js";
import type { AcquisitionResult, GeneratedProject, PackagingResult, PipelineRun, RunSummary, ValidationResult } from "../types/pipeline.js";
import { formatDuration, readJsonIfExists, toPosixRelative, writeJson } from "../utils/file-utils.js";
import { isoTimestamp } from "../utils/logger.js";
import { loadPackagingResults } from "./packager.js";
import { loadGeneratedProjects } from "./ui-generator.js";
import { loadValidationResults } from "./validator.js";

/** Phase 9 — a readable summary of the whole run (artifacts/report.md + report.json). Tolerates gaps. */

const md = (s: unknown) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

export async function writeReport(run: PipelineRun): Promise<{ markdownFile: string; jsonFile: string; summary: RunSummary }> {
  const { ctx } = run;
  const p = ctx.paths;
  const rel = (f: string) => toPosixRelative(p.root, f);
  const state = run.checkpoint.state;

  const acquisitions: AcquisitionResult[] = [];
  const tokens: Array<DesignTokens | null> = [];
  const manifests: Array<FeatureManifest | null> = [];
  for (const site of run.sites) {
    const a = await readJsonIfExists<AcquisitionResult | null>(path.join(p.acquisitionDir, site.slug, "acquisition.json"), null);
    if (a) acquisitions.push(a);
    tokens.push(await readJsonIfExists<DesignTokens | null>(path.join(p.designTokensDir, site.slug, "tokens.json"), null));
    manifests.push(await readJsonIfExists<FeatureManifest | null>(path.join(p.featureManifestsDir, `${site.slug}.json`), null));
  }
  const union = await readJsonIfExists<UnionManifest | null>(path.join(p.featureManifestsDir, "UNION.json"), null);
  const content = await readJsonIfExists<ContentDocument | null>(path.join(p.contentDir, "content.json"), null);
  const projects = await loadGeneratedProjects(ctx);
  const validations = await loadValidationResults(ctx, projects);
  const packaging = await loadPackagingResults(ctx, projects);
  const byName = <T extends { project: string }>(list: T[], name: string) => list.find((x) => x.project === name);

  const summary: RunSummary = {
    runId: state.runId,
    durationMs: Date.now() - Date.parse(state.startedAt),
    projects: projects.map((proj) => {
      const pk = byName(packaging, proj.projectName);
      const v = byName(validations, proj.projectName);
      return {
        name: proj.projectName,
        dir: rel(proj.dir),
        runCommand: pk?.runCommand ?? `cd ${rel(proj.dir)} && npm run dev`,
        built: pk?.built ?? false,
        smokeTest: pk?.smokeTest ?? "skipped",
        validationPassed: v?.passed ?? false,
      };
    }),
    reportFile: rel(p.reportFile),
    warnings: [
      ...acquisitions.filter((a) => !a.ok).map((a) => `Could not acquire ${a.url}: ${a.error ?? "unknown"}`),
      ...tokens.filter((t): t is DesignTokens => Boolean(t) && t!.extractor === "default").map((t) => `Default design tokens used for ${t.sourceUrl}`),
      ...(content?.meta.warnings ?? []),
      ...projects.flatMap((proj) => proj.warnings.map((w) => `${proj.projectName}: ${w}`)),
      ...packaging.filter((pk) => !pk.built).map((pk) => `${pk.project}: ${pk.error ?? "not built"}`),
    ],
  };

  const L: string[] = [];
  L.push(`# Artist Site Factory — run report`, "");
  L.push(`Run \`${state.runId}\` · started ${state.startedAt} · report written ${isoTimestamp()} · ${formatDuration(summary.durationMs)}`, "");
  L.push("## How to run the sites", "");
  if (!summary.projects.length) L.push("No projects were generated.", "");
  for (const proj of summary.projects) L.push(`- **${proj.name}** — \`${proj.runCommand}\` → http://localhost:3000 ${proj.built ? "" : "(⚠ build failed — see below)"}`);
  L.push("");

  L.push("## Phases", "", "| # | Phase | Status | Duration |", "|---|---|---|---|");
  for (const def of PHASES) {
    const ps = state.phases[def.id];
    L.push(`| ${def.n} | ${def.title} | ${ps.status} | ${ps.durationMs ? formatDuration(ps.durationMs) : "—"} |`);
  }
  L.push("");

  L.push("## Inspiration sites", "", "| URL | Acquired | Design tokens | Primary | Fonts | Features detected |", "|---|---|---|---|---|---|");
  run.sites.forEach((site, i) => {
    const a = acquisitions.find((x) => x.slug === site.slug);
    const t = tokens[i];
    const m = manifests[i];
    L.push(
      `| ${md(site.url)} | ${a ? (a.ok ? `yes (${a.methods.join(" + ")})` : `no — ${md(a.error)}`) : "—"} | ${t ? (t.extractor === "chhapify" ? `chhapify${t.score ? ` (score ${t.score.overall}/100)` : ""}` : "default set") : "—"} | ${md(t?.colors.primary ?? "—")} | ${md(t?.typography.families.slice(0, 3).join(", ") || "—")} | ${m ? `${m.features.length}${m.usedBaseline ? " (baseline)" : ""}` : "—"} |`,
    );
  });
  L.push("");

  L.push("## Feature union (rendered on every site)", "");
  if (union) {
    L.push("| Feature | Seen on | Layouts | Components |", "|---|---|---|---|");
    for (const f of union.features) L.push(`| ${md(f.type)} | ${f.sources.length ? f.sources.length : f.source.detector} | ${md(f.layouts.join(", "))} | ${md(f.components.slice(0, 6).join(", "))} |`);
  } else L.push("Not computed.");
  L.push("");

  L.push("## Artist content", "");
  if (content) {
    L.push(
      `**${md(content.name)}** — ${md(content.tagline)}. ${content.discography.length} releases, ${content.topSongs.length} songs, ${content.videos.length} videos, ${content.images.gallery.length} photos, ${content.pressQuotes.length} quotes, ${content.tourDates.length} tour dates. LLM used for text: ${content.meta.llmUsed ? "yes" : "no"}.`,
      "",
      "### Fact checks (config/artist.json → claimsToVerify)",
      "",
      "| Claim | Status | Evidence |",
      "|---|---|---|",
    );
    for (const c of content.meta.claims) L.push(`| ${md(c.claim)} | **${c.status}** | ${md((c.evidence ?? c.note ?? "").slice(0, 220))} |`);
    L.push("", "### Sources", "", "| Provider | Status | Detail |", "|---|---|---|");
    for (const pr of content.meta.providers) L.push(`| ${md(pr.id)} | ${pr.status} | ${md((pr.detail ?? "").slice(0, 160))} |`);
  } else L.push("Not synthesized.");
  L.push("");

  L.push("## Generated sites", "", "| Site | Inspiration tokens | Palette (bg / primary / accent) | Fonts | Page composition | Validation | Build | Smoke test |", "|---|---|---|---|---|---|---|---|");
  for (const proj of projects) {
    const v = byName(validations, proj.projectName);
    const pk = byName(packaging, proj.projectName);
    L.push(
      `| ${proj.projectName} | ${md(proj.inspiration.url ?? "default")} | ${md(`${proj.theme.background} / ${proj.theme.primary} / ${proj.theme.accent}`)} | ${md(`${proj.theme.fonts.display} / ${proj.theme.fonts.body}`)} | ${proj.specSource} | ${v ? `${v.passed ? "passed" : "needs attention"} (${v.issues.length} findings, ${v.fixedCount} fixed) — [report](${path.relative(path.dirname(p.reportFile), path.join(p.root, v.reportFile)).split(path.sep).join("/")})` : "—"} | ${pk ? (pk.built ? `ok${pk.fixesApplied.length ? ` (${pk.fixesApplied.length} auto-fix)` : ""}` : "failed") : "—"} | ${pk?.smokeTest ?? "—"} |`,
    );
  }
  L.push("");
  if (summary.warnings.length) {
    L.push("## Warnings", "");
    for (const w of summary.warnings.slice(0, 60)) L.push(`- ${md(w)}`);
    L.push("");
  }
  L.push("---", "", `Full log: \`${rel(p.logFile)}\` · task graph: \`${rel(p.taskGraphFile)}\``);

  await fs.outputFile(p.reportFile, `${L.join("\n")}\n`, "utf8");
  await writeJson(p.reportJsonFile, { summary, sites: run.sites, union: union?.featureTypes ?? [], claims: content?.meta.claims ?? [], projects, validations, packaging });
  return { markdownFile: p.reportFile, jsonFile: p.reportJsonFile, summary };
}
