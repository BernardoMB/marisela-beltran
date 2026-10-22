# artist-site-factory — Architecture & Module Contract

Developer reference for the pipeline: what each module exports, where every artifact lives and the
rules the generated sites follow. User-facing instructions are in the root `README.md`; the original
specification (with an "Implementation notes" header listing where the build deviates from it) is in
`CLAUDE.md`.

Foundation modules shared by every phase: `src/utils/{logger,file-utils,shell,checkpoint,config,llm}.ts`,
`src/schemas/*.ts` (Zod schemas for every artifact), `src/types/pipeline.ts` (inter-module result
types), `src/generators/{color,theme-generator}.ts`, `templates/shared/**`, `config/*.json`.

---

## 1. Pipeline

`npm start` → `src/index.ts` → `new Orchestrator(ctx, logger).run(urls)`

| Phase | Id | Module (AgentMesh role) | Output |
|---|---|---|---|
| 1 | PHASE_1_ACQUISITION | `src/agents/site-acquirer.ts` (specialist) | `artifacts/acquisition/<slug>/` |
| 2 | PHASE_2_DESIGN_EXTRACTION | `src/agents/design-extractor.ts` (specialist) | `artifacts/design-tokens/<slug>/` |
| 3 | PHASE_3_FEATURE_INVENTORY | `src/agents/feature-inventory.ts` (specialist) | `artifacts/feature-manifests/<slug>.json` |
| 4 | PHASE_4_FEATURE_UNION | `src/agents/feature-inventory.ts` | `artifacts/feature-manifests/UNION.json` |
| 5 | PHASE_5_CONTENT_SYNTHESIS | `src/agents/content-synthesizer.ts` (specialist) | `artifacts/marisela-content/content.json` |
| 6 | PHASE_6_UI_GENERATION | `src/agents/ui-generator.ts` (**Coder**) | `generated-websites/<project>/`, `artifacts/ui-specs/` |
| 7 | PHASE_7_VALIDATION | `src/agents/validator.ts` (**Debugger**) | `artifacts/validation-reports/<project>.md` |
| 8 | PHASE_8_PACKAGING | `src/agents/packager.ts` (**Reviewer**) | `node_modules/`, `RUN.md`, build logs |
| 9 | PHASE_9_REPORT | `src/agents/reporter.ts` (reporter) | `artifacts/report.md`, `artifacts/report.json` |

The **Planner** (`src/agents/planner.ts`) emits `artifacts/task-graph.json` before phase 1.

Resumability: `STEPN_RUNNING` / `STEPN_COMPLETED` / `STEPN_FAILED` sentinels at the repo root
(`src/utils/checkpoint.ts`), plus per-item progress in `.orchestrator-state.json`. **Every phase must
be re-runnable from its persisted inputs** (it may not rely on in-memory results of earlier phases),
and must skip items already completed (`run.checkpoint.isItemDone(phaseId, key)`), marking items with
`run.checkpoint.setItem(phaseId, key, "completed" | "degraded" | "failed", detail)`.

### Graceful degradation (hard rule)
A single URL, provider or tool failing must **never** fail the pipeline. Log a warning (with the
reason), fall back (default tokens / baseline features / omitted content), mark the item `degraded`,
continue. A phase throws only for programmer errors or when no output at all can be produced.

---

## 2. Conventions (all TypeScript in `src/`)

- ESM + `"module": "NodeNext"`: **relative imports end in `.js`** (`import { x } from "../utils/shell.js"`).
- Zod **v4** (`import { z } from "zod"`): `z.record(keySchema, valueSchema)` needs both args;
  `z.looseObject`/`z.strictObject` replace passthrough/strict; `z.toJSONSchema(schema)` exists.
- Never `console.log` — use `run.logger` (`logger.child("name")` for a prefix). Subprocess output is
  captured automatically by `run()` from `src/utils/shell.ts`.
- External commands: `run(file, args, { cwd, env, timeoutMs, label })` (never throws on non-zero exit,
  check `.failed`), `runOrThrow`, `spawnBackground`, `commandExists`, `killTree`. Windows-safe.
- JSON artifacts: `writeJson` (atomic). Paths always from `run.ctx.paths.*`. Store repo-relative paths
  in artifacts with `toPosixRelative(ctx.paths.root, abs)`.
- Network: global `fetch` with `AbortSignal.timeout(ms)` and a descriptive `User-Agent`
  (`artist-site-factory/1.0 (+https://github.com/)`); MusicBrainz requires ≤ 1 req/s.
- Browser automation: `import { chromium } from "playwright"` (Chromium is installed by `postinstall`).
  Always close browsers in `finally`.
- LLM: only through `src/utils/llm.ts` (`initLLM`, `llmAvailable()`, `generateText`,
  `generateStructured`, `describeLLMError`, `disableLLM`). Provider resolution (`llm.provider` = auto):
  Anthropic API when `ANTHROPIC_API_KEY` is set (streaming, adaptive thinking, server-side model
  fallbacks), else the local Claude Code CLI (`claude -p --output-format json`, no tools, no session
  persistence, explicit `--model`/`--effort`), else off. Every LLM use has a deterministic fallback.
  Circuit breaker: an auth error, rate/usage/session limit (API error class or CLI output matched by
  `isClaudeUnavailableText`) calls `markLLMExhausted(reason)` — every later call in the run is skipped
  (`llmAvailable()` → false), including site-facelift's review. Every nested `claude` process gets
  `nestedClaudeEnv()`: the parent Claude Code session's variables (`CLAUDECODE`, session id, messaging
  socket, `CLAUDE_EFFORT` …) are removed so a run started from Claude Code behaves like one started
  from a terminal. LLM-dependent functions accept an injected fake (`opts.llm?: typeof generateText`,
  `opts.llmStructured`) so tests never need a real model.
- Timestamps: `isoTimestamp()` from logger.ts.
- The factory writes only inside the repo (plus OS temp dirs) and deletes only inside `artifacts/`,
  `generated-websites/` and `vendor/` (`npm run reset`).

---

## 3. Module signatures

### 3.1 `src/agents/site-acquirer.ts` (Phase 1)
```ts
export async function acquireSites(run: PipelineRun): Promise<AcquisitionResult[]>;
export async function loadAcquisition(ctx: FactoryContext, slug: string): Promise<AcquisitionResult | null>;
```
Per site (concurrency `ctx.config.concurrency.urls`): Playwright Chromium (UA/locale from config,
1440×900) → goto (`acquisition.navigationTimeoutMs`), settle, dismiss cookie banners best-effort,
auto-scroll for lazy content → save `raw.html` (document response), `rendered.html`, CSS/JS assets
(≤ `maxAssets`, ≤ `maxAssetBytes` each) under `assets/`, `screenshot-desktop.png` (full page, cap height
~10 000px), `screenshot-mobile.png` (390×844), `dom-snapshot.json` (`captureDomSnapshot`).
If `acquisition.useFaceliftCrawler`, also call `faceliftCrawl(...)` into `facelift-crawl/` (failure = warning).
Write `artifacts/acquisition/<slug>/acquisition.json` (AcquisitionResult). Unreachable URLs → `ok:false`.

### 3.2 `src/tools/dom-snapshot.ts`
```ts
export interface DomSnapshot { /* url, title, lang, viewport, documentHeight, meta, sections[], headings[],
  forms[], iframes[], media counts, images stats, links (internal/external/social/anchors/mailto/tel),
  buttons[], blockquotes[], classTokens[], scriptHosts[], dateLikeCount, textSample … */ }
export const DOM_SNAPSHOT_SCRIPT: string;                                  // self-contained IIFE source
export async function captureDomSnapshot(page: Page): Promise<DomSnapshot>; // page.evaluate(DOM_SNAPSHOT_SCRIPT)
```
The snapshot script is shipped as a string (not a function) so bundler/transpiler helpers can never
leak into the browser context.

### 3.3 `src/agents/feature-inventory.ts` (Phases 3–4)
```ts
export async function buildFeatureInventories(run: PipelineRun): Promise<FeatureInventoryResult[]>;
export function analyzeDomSnapshot(snapshot: DomSnapshot, url: string, featureMap: FeatureMap): Feature[];
export async function loadFeatureManifest(ctx: FactoryContext, slug: string): Promise<FeatureManifest | null>;
export async function computeFeatureUnion(run: PipelineRun): Promise<UnionManifest>;
export async function loadUnion(ctx: FactoryContext): Promise<UnionManifest>;
```
Per URL: heuristic analyzer (from `dom-snapshot.json`) + Clooney-Agent (when enabled and
`ctx.env.geminiApiKey` is set) → merge by type → baseline set if empty (`featureMap.baseline`,
detector "baseline"). Union: merge by `type` into superset features (union of components,
interactions, layouts; sources = URLs) + every `alwaysInclude` type (detector "required"); order
`featureTypes` by `feature-map.json` key order; log `Union contains N unique feature types: [...]`.

### 3.4 `src/tools/run-clooney.ts`
```ts
export interface ClooneyInstall { repoUrl: string; repoSlug: string; dir: string; ref: string; adapter: "agent-clooney" }
export interface ClooneyComponentSpec { id?: string; name?: string; category?: string; description?: string; [k: string]: unknown }
export async function ensureClooney(ctx: FactoryContext, logger: Logger): Promise<ClooneyInstall | null>;
export async function runClooneyAnalysis(install: ClooneyInstall, opts: {
  url: string; outFile: string; breakpoints: Array<"mobile" | "tablet" | "desktop">;
  timeoutMs: number; geminiApiKey: string; logger: Logger;
}): Promise<{ ok: boolean; components: ClooneyComponentSpec[]; error?: string }>;
export function normalizeClooneyComponents(components: ClooneyComponentSpec[], url: string, featureMap: FeatureMap): Feature[];
```
`ensureClooney` tries `tools.clooney.repoUrls` in order (existence check with `git ls-remote` and
`GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, `-c credential.helper=` so no credential popup can
appear), shallow-clones into `vendor/clooney-agent`, checks out the pinned ref, installs runtime deps
(`npm install --omit=dev --ignore-scripts --no-audit --no-fund`), writes
`vendor/clooney-agent/.factory/run-analysis.ts` (imports `createVLMAnalysisAgent` from
`../lib/agents/vlm-agent`, calls `analyzePageVisuals(url, "home", { breakpoints })`, writes the
AnalysisResult JSON), marks `.factory-installed` with the commit sha. Runner executes with the root
`tsx` (`node <root>/node_modules/tsx/dist/cli.mjs`) in cwd `vendor/clooney-agent`, env
`GOOGLE_GENERATIVE_AI_API_KEY=<gemini key>` (and `OPENAI_API_KEY` passed through). Unknown repos →
no adapter → skipped with a warning.

### 3.5 `src/tools/run-chhapify.ts` + `src/agents/design-extractor.ts` (Phase 2)
```ts
// run-chhapify.ts
export interface ChhapifyRun { ok: boolean; outDir: string; files: Record<string, string>; exitCode: number | null; error?: string; durationMs: number }
export async function runChhapify(opts: { url: string; outDir: string; name: string; extraArgs: string[]; timeoutMs: number; root: string; logger: Logger }): Promise<ChhapifyRun>;
export function parseCssVariables(css: string): Record<string, string>;
export async function parseChhapifyOutputs(opts: { outDir: string; name: string; url: string; slug: string; root: string }): Promise<DesignTokens>;
// design-extractor.ts
export async function extractDesignSystems(run: PipelineRun): Promise<DesignExtractionResult[]>;
export async function loadDefaultTokens(ctx: FactoryContext): Promise<DesignTokens>;
export async function loadDesignTokensForSite(ctx: FactoryContext, site: InspirationSite): Promise<DesignTokens>; // default tokens (slug kept) if missing
export async function loadAllDesignTokens(run: PipelineRun): Promise<Map<string, DesignTokens>>; // key = slug
```
chhapify runs as `node <resolved chhapify/bin/design-extract.js> <url> --full --out <dir> --name <slug> --no-history`
(equivalent to `npx chhapify`, but never touches the network registry). On failure/timeout retry once
without `--full`; then fall back to `config/default-design-tokens.json`. Outputs:
`artifacts/design-tokens/<slug>/` = all chhapify files + `tokens.json` (DesignTokens) + `extraction.json`.

### 3.6 `src/tools/run-content-fetch.ts`, `src/tools/providers/*.ts`, `src/agents/content-synthesizer.ts` (Phase 5)
```ts
// run-content-fetch.ts
export interface SourceDoc { sourceId: string; name: string; url: string; lang?: "es" | "en"; text: string; license?: string }
export interface RawSourceBundle { /* resolved ids, per-provider raw data, docs: SourceDoc[], sources: SourceRef[], providers: ProviderRun[], warnings: string[] */ }
export async function fetchAllSources(ctx: FactoryContext, logger: Logger): Promise<RawSourceBundle>;
// content-synthesizer.ts
export async function synthesizeContent(run: PipelineRun, opts?: { llm?: typeof generateText; llmStructured?: typeof generateStructured }): Promise<{ file: string; document: ContentDocument }>;
export async function loadContent(ctx: FactoryContext): Promise<ContentDocument>;
export function verifyClaims(claims: ArtistConfig["claimsToVerify"], docs: SourceDoc[], known: { birthDate?: string; legalNames?: string[] }): ClaimCheck[];
```
Sources (no keys needed): Wikidata (anchor `Q2890550`), Wikipedia es/en (REST summary + plaintext
extract), MusicBrainz (url-rels, release-groups), Deezer (artist, top tracks, albums), iTunes Search,
official site (`/biografia`, `/videos`, `/gira`, `/noticias`, `/contacto`, social links), YouTube oEmbed,
Wikimedia Commons (free-licensed images + license metadata), Spotify public page via Playwright
(monthly listeners, best effort). Tour dates: Ticketmaster Discovery API (`TICKETMASTER_API_KEY`),
Bandsintown (`BANDSINTOWN_APP_ID`), else best-effort public pages — **never invent dates**; only
future dates. Raw dumps → `artifacts/marisela-content/raw/<provider>.json`. Images →
`artifacts/marisela-content/images/{hero.jpg,covers/<albumId>.jpg,gallery/*}` with `ImageAsset.localFile`.
Output validated with `ContentDocumentSchema`. Rules: no fabricated facts; display name =
`displayNameOverride ?? Wikidata/Wikipedia label ?? searchName` (log when `requestedDisplayName` is
not corroborated); claims from `config/artist.json` are verified against source docs and only
verified claims may appear in tagline/stats; biography in the site language with source attribution
(`sourceNote`, CC BY-SA for Wikipedia text); press quotes are **verbatim** excerpts from cited sources.

### 3.7 `src/generators/component-registry.ts` (json-render catalog)
```ts
export const CATALOG_COMPONENTS: readonly ["Page","NavBar","Hero","StatsBand","Biography","Discography","TopSongs","TourDates","VideoGallery","PhotoGallery","MusicPlayer","PressQuotes","Newsletter","SocialLinks","ContactBooking","FeatureSection","SectionDivider","Footer"];
export type CatalogComponentName = (typeof CATALOG_COMPONENTS)[number];
export interface BriefManifest { briefId: string; components: string[]; variants: Partial<Record<CatalogComponentName, string[]>>; notes?: string }
export async function loadBriefManifest(ctx: FactoryContext, brief: DesignBrief): Promise<BriefManifest>;
export interface CatalogBundle {
  catalog: ReturnType<typeof defineCatalog>;          // @json-render/core + @json-render/react/schema
  componentByFeature: Record<string, CatalogComponentName>;
  requiredFeatureTypes: string[];                      // = union.featureTypes
  allowedStatePaths: string[];                         // JSON pointers into ArtistContent usable with $state
  anchors: Record<string, string>;                     // featureType → anchor id (site language)
}
export function buildCatalog(opts: { union: UnionManifest; brief: DesignBrief; manifest: BriefManifest; featureMap: FeatureMap; lang: "es" | "en" }): CatalogBundle;
export function anchorIdFor(featureType: string, lang: "es" | "en"): string;
```
Catalog component props are Zod mirrors of `templates/shared/lib/types.ts` props; `variant`/`layout`
enums come from the brief manifest. Spanish anchors: hero→`inicio`, music-player→`escuchar`,
discography→`discografia`, top-songs→`canciones`, tour-dates→`gira`, biography→`biografia`,
stats→`cifras`, video→`videos`, photo-gallery→`galeria`, press-quotes→`prensa`, newsletter→`boletin`,
contact→`contacto`, social-links→`redes`, merch→`tienda`, fan-club→`club`, countdown→`proximamente`,
news→`noticias`, lyrics→`letras` (English: home, listen, discography, songs, tour, biography, stats,
videos, gallery, press, newsletter, contact, social, store, fan-club, coming-soon, news, lyrics).

### 3.8 Spec conventions (json-render, React flat schema)
- `{ root: "page", elements: { page: { type: "Page", props: { title, description, lang }, children: [...] }, … } }`
- `Page.children` = ordered page elements: `NavBar` first, sections…, optional `SectionDivider`s, `Footer` last.
  All other elements are leaves (`children: []`).
- Data binding: `{ "$state": "/discography" }` — JSON pointer into ArtistContent; only `allowedStatePaths`.
  The spec **never** carries its own `state` (any model-emitted `/state` is discarded — the default
  json-render prompt asks models to invent sample data; we forbid it).
- No `repeat`, `visible`, `on`, `watch` (static marketing site).
- Section elements carry `anchorId` (enforced by `normalizeSpec`). `FeatureSection.featureType` names the union type it covers.
- Coverage: for every union feature type there is an element whose component is
  `componentByFeature[type]` (and for FeatureSection, `props.featureType === type`).

### 3.9 `src/generators/spec-builder.ts`, `src/generators/spec-renderer.ts`, `src/agents/ui-generator.ts` (Phase 6)
```ts
// spec-builder.ts
export function resolveCopyTokens(text: string, content: ArtistContent): string | null; // {name},{alias},{debutYear}; drop " · "-separated segments that can't resolve; null if empty
export function leadFor(content: ArtistContent): string | undefined; // biography lead, omitted when paragraph 1 already opens with it
export function buildDeterministicSpec(opts: { brief: DesignBrief; bundle: CatalogBundle; manifest: BriefManifest; union: UnionManifest; content: ArtistContent; lang: "es" | "en" }): Spec;
// spec-renderer.ts
export function normalizeSpec(spec: Spec, bundle: CatalogBundle, content: ArtistContent, fallback: Spec): { spec: Spec; fixes: string[] };
export function checkSpecCoverage(spec: Spec, bundle: CatalogBundle): { missing: string[]; present: string[] };
export function renderPageTsx(spec: Spec, opts: { content: ArtistContent }): string;
// src/tools/run-json-render.ts (LLM path)
export async function generateSpecWithLLM(opts: { bundle; brief; briefPrompt; content; union; lang; model; effort; maxTokens; maxRepairAttempts; logger; llm? }): Promise<LLMSpecResult>;
// ui-generator.ts
export async function generateProjects(run: PipelineRun, opts?: { llm?: typeof generateText; scaffold?: (o: ScaffoldOptions) => Promise<{ files: string[] }> }): Promise<GeneratedProject[]>;
export async function loadGeneratedProjects(ctx: FactoryContext): Promise<GeneratedProject[]>;
export function chooseInspiration(briefs: DesignBrief[], sites: InspirationSite[], tokensBySlug: Map<string, DesignTokens>, seed: string, defaultTokens?: DesignTokens): Map<string, DesignTokens>;
```
`CANONICAL_BINDINGS` (component-registry.ts) fixes the `$state` pointer of every data prop (e.g.
`Discography.albums` → `/discography`); whatever the model writes for those props is replaced, so a
spec can never point a component at the wrong data.
`generateProjects`, per brief (skip if item done and `.factory/project.json` exists): pick tokens
(seeded "random" URL per brief; log choice) → `generateTheme(brief, tokens)` → `buildCatalog` →
spec: LLM path when `llmAvailable()` and `tools.jsonRender.useLLM` allows (system =
`catalog.prompt({ system: <brief prompt markdown + role>, customRules: [...brief.jsonRenderRules, ...factory rules] })`,
user = `buildUserPrompt({ prompt, state: compactContentState })`; parse with `compileSpecStream`;
validate with `catalog.validate` + `validateSpec`; coverage; repair loop up to `maxRepairAttempts`
feeding `formatSpecIssues`; `autoFixSpec` last) else deterministic → `normalizeSpec` (merges
missing coverage from the deterministic spec) → `renderPageTsx` → `scaffoldProject(...)` → write
`artifacts/ui-specs/<project>.spec.json` (+ `.prompt.md` with the exact prompts used, + `.catalog-prompt.txt`)
and `generated-websites/<project>/.factory/project.json` (GeneratedProject).

`renderPageTsx` output (server component, no "use client"):
```tsx
import { artistContent } from "@/lib/content";
import Hero from "@/components/Hero";            // one default import per component used
export default function Home() {
  return (<>
    <NavBar brand={"Marisela"} links={[...]} socials={artistContent.socialLinks} />
    <main id="contenido">
      <Hero anchorId={"inicio"} title={"Marisela"} image={artistContent.images.hero} … />
      …
    </main>
    <Footer … />
  </>);
}
```
Literal props → `prop={<JSON literal>}`. `$state` → property-access expression on `artistContent`
(bracket notation if needed). Scalars that resolve to `undefined` for **required** props must not be
emitted as possibly-undefined expressions (resolve at generation time; fall back to a safe literal).
The output must type-check against `templates/shared/lib/types.ts`.

### 3.10 `src/generators/nextjs-scaffold.ts`, `src/generators/content-injector.ts`, `src/generators/placeholder-art.ts` (Phase 6)
```ts
// content-injector.ts
export function toSiteContent(doc: ContentDocument): ArtistContent;                 // strips meta + localFile
export function renderContentModule(content: ArtistContent): string;                // lib/content.ts
export async function injectContent(opts: { ctx: FactoryContext; doc: ContentDocument; projectDir: string; theme: Theme; brief: DesignBrief }): Promise<{ content: ArtistContent; copiedImages: string[]; placeholders: string[] }>;
// placeholder-art.ts
export function coverPlaceholderSvg(title: string, year: number | undefined, theme: Theme, brief: DesignBrief): string;
export function heroPlaceholderSvg(name: string, theme: Theme, brief: DesignBrief): string;
export function faviconSvg(name: string, theme: Theme): string;
// nextjs-scaffold.ts
export interface ScaffoldOptions { ctx: FactoryContext; brief: DesignBrief; theme: Theme; tokens: DesignTokens; doc: ContentDocument; spec: Spec; pageTsx: string; projectDir: string; logger: Logger }
export async function scaffoldProject(opts: ScaffoldOptions): Promise<{ files: string[]; content: ArtistContent }>;
```
Generated project (`generated-websites/marisela-site-0N-<slug>/`):
```
package.json            "type": "module"; scripts dev/build/start; versions from config.generation
next.config.js          ESM; outputFileTracingRoot: __dirname; eslint.ignoreDuringBuilds: true
postcss.config.js       ESM: export default { plugins: { "@tailwindcss/postcss": {} } }
tailwind.config.ts      renderTailwindConfig(theme)       (loaded by @config in globals.css)
tsconfig.json           create-next-app 15 defaults, paths { "@/*": ["./*"] }
next-env.d.ts           /// <reference types="next" /> + image-types (no routes.d.ts line)
.gitignore              node_modules, .next, out, *.log, .env*
README.md               what this is, how to run, content provenance & licenses
app/layout.tsx          next/font/google fonts → --font-display/--font-body/--font-mono on <html>; lang;
                        metadata (title "<name> — <tagline>", description shortBio, openGraph image)
app/page.tsx            renderPageTsx(spec)
app/globals.css         renderGlobalsCss(theme, templates/shared/styles/skin-base.css + templates/briefs/<id>/styles.css)
app/icon.svg            faviconSvg
app/not-found.tsx       small themed 404
components/*.tsx        templates/shared/components/** then templates/briefs/<id>/components/* (brief wins on a name clash)
lib/types.ts utils.ts i18n.ts use-audio-preview.ts   (templates/shared/lib)
lib/content.ts          renderContentModule(...)  — `export const artistContent: ArtistContent = …`
lib/theme.ts            renderThemeModule(theme)
lib/ui-spec.json        the json-render spec
public/images/          hero.jpg, covers/*.jpg, gallery/*, placeholders/*.svg, CREDITS.md
styles/inspiration-shadcn-theme.css   chhapify's original shadcn theme (reference, not imported)
.factory/project.json   GeneratedProject metadata (validation.json, packaging.json added later)
.factory/review/page.md text rendering reviewed by site-facelift (phase 7; + facelift-validation.md)
```
Regenerating a project (`--from 6`) replaces `app/ components/ lib/ public/ styles/` and keeps
`node_modules/` and `.next/`, so a re-run does not reinstall dependencies.
RUN.md is written by the packager. Font fallbacks: `brief.fonts.*.fallback`. Tailwind v4 note:
`@config "../tailwind.config.ts";` is verified to work with Tailwind 4.3.3 (CSS-var colors incl.
opacity modifiers).

### 3.11 `src/tools/run-facelift.ts`, `scripts/facelift_bridge.py`, `src/agents/validator.ts`, `src/agents/packager.ts` (Phases 7–8)
```ts
// run-facelift.ts
export interface FaceliftEnv { python: string; venvDir: string; version: string; claudeAvailable: boolean }
export async function ensureFacelift(ctx: FactoryContext, logger: Logger): Promise<FaceliftEnv | null>;   // vendor/facelift-venv, pip install site-facelift==<version>
export async function faceliftCrawl(opts: { ctx: FactoryContext; url: string; destDir: string; maxPages: number; maxAssets: number; logger: Logger }): Promise<{ ok: boolean; files: number; error?: string }>;
export async function faceliftReview(opts: { ctx: FactoryContext; env: FaceliftEnv; projectDir: string; reportPath: string; logger: Logger; dryRun?: boolean }): Promise<{ status: "ran" | "skipped" | "failed"; reportPath?: string; detail?: string }>;
export async function faceliftCleanup(opts: { ctx: FactoryContext; env: FaceliftEnv; projectDir: string; reportPath: string; deferredPath: string; logger: Logger; dryRun?: boolean }): Promise<{ status: "ran" | "skipped" | "failed"; detail?: string }>;
export function parseFaceliftValidation(markdown: string): ValidationIssue[];
// validator.ts
export async function validateProjects(run: PipelineRun, projects: GeneratedProject[]): Promise<ValidationResult[]>;
export async function loadValidationResults(ctx: FactoryContext, projects: GeneratedProject[]): Promise<ValidationResult[]>;
// packager.ts
export async function packageProjects(run: PipelineRun, projects: GeneratedProject[]): Promise<PackagingResult[]>;
export async function loadPackagingResults(ctx: FactoryContext, projects: GeneratedProject[]): Promise<PackagingResult[]>;
```
site-facelift's CLI only accepts a URL (no `validate` subcommand). The bridge script imports
`facelift.crawler`, `facelift.prompts.VALIDATION_PROMPT` / `CLEANUP_PROMPT`, `facelift.claude_runner.run_claude`
and `facelift.sentinel` from the venv and exposes `crawl | validate | cleanup | selftest` (+ `--dry-run`).
Run it as `<venv python> -I -X utf8 scripts/facelift_bridge.py …` (`-X utf8`: on Windows, facelift's
runner otherwise decodes Claude's output with the ANSI code page and crashes). AI review mode =
`tools.facelift.aiReview` (env `FACELIFT_AI_REVIEW` overrides): auto → only when the `claude` CLI exists
**and** `llmAvailable()` (so `--no-ai`, `llm.provider: "off"` and a mid-run limit all skip it).
facelift's runner takes no model/effort flags, so the bridge process gets `ANTHROPIC_MODEL` /
`CLAUDE_EFFORT` from `tools.facelift.model` / `effort` (default `sonnet` / `medium`).
**Review input:** `faceliftReview({ …, siteDir })` points VALIDATION_PROMPT (written for a *built*
site) at `.factory/review/page.md`, rendered by `src/generators/review-bundle.ts`
(`renderReviewBundle({ spec, content, projectName, briefName })`): every visible heading, text,
label, list item and image (path + alt) in page order, tagged with the file it comes from, plus an
image-reuse index. Reviewing the whole project instead made Claude explore every source file and
image (≈7 min per site). Reviews run `concurrency.reviews` (default 2) projects at a time.
Mechanical validation (always): the six facelift headings (image reuse, image placement, typos,
repetition, awkward phrasing/placeholders, missing/broken: `href="#"`, anchors without matching section
ids, missing public files, empty alt, missing metadata) + structure checks (every union feature
present, every imported component file exists, mojibake). Auto-fix the obvious (typos in our own
copy, broken anchors, empty alt with clear context) and log the rest. Report →
`artifacts/validation-reports/<project>.md` + `.factory/validation.json`.
Packager: `npm install` (config args) → `npm run build` (`NEXT_TELEMETRY_DISABLED=1`, log to
`artifacts/build-logs/<project>.log`) → auto-fix loop (missing package → install; font fetch failure →
system-font fallback layout; type errors → `typescript.ignoreBuildErrors` as last resort, recorded) →
smoke test (`npm run dev -- --port <p>` until ready, GET `/` = 200 and contains the artist name, then
kill the tree) → keep `node_modules` → `RUN.md` → `.factory/packaging.json`.

### 3.12 `src/agents/planner.ts`, `src/agents/reporter.ts`, `src/orchestrator.ts`, `src/index.ts`
```ts
// planner.ts
export function planTaskGraph(run: PipelineRun): TaskGraph;
export async function writeTaskGraph(run: PipelineRun, graph: TaskGraph): Promise<void>;
export async function updateTaskStatus(run: PipelineRun, nodeIdPrefix: string, status: TaskNode["status"]): Promise<void>;
// reporter.ts
export async function writeReport(run: PipelineRun): Promise<{ markdownFile: string; jsonFile: string; summary: RunSummary }>;
// orchestrator.ts
export const DEFAULT_HANDLERS: PhaseHandlers;           // PhaseId → (run) => Promise<details | void>
export function buildSites(urls: string[]): InspirationSite[];
export class Orchestrator {
  constructor(ctx: FactoryContext, logger: Logger, handlers?: Partial<PhaseHandlers>); // handlers: test seam
  run(urls: string[]): Promise<RunSummary>;
}
// cli.ts (pure; tested without running the pipeline)
export function parseArgs(argv: string[]): CliFlags & { help: boolean; urlInputs: string[] };
export function normalizeUrl(raw: string): string | null;            // adds https://, strips <>/quotes, http(s) only
export function normalizeUrls(inputs: string[]): { urls: string[]; invalid: string[] };
export function parseUrls(fileText: string): { urls: string[]; invalid: string[] };
export function isPlaceholderUrl(url: string): boolean;              // example.com / example-artist-N.com
// index.ts: flags --urls <url...> | --urls <file>, --no-ai, --fresh, --from <n>, --variations <n>, --verbose, --reset, --help
```
`npm run generate-websites -- --urls a.com b.com` (= `npm start`): URLs from the command line are
normalized, saved to `config/urls.txt` (previous list → `config/urls.previous.txt`) so a plain
`npm start` resumes the same run; a single `--urls` value naming an existing file is read as a URL
list instead. Placeholder URLs are dropped; with none left the CLI exits 1 *before* opening
`factory.log` or the state file. The Claude Code command `.claude/commands/generate-websites.md`
(`/generate-websites --urls …`, `disable-model-invocation`) runs this in the background and
summarizes `artifacts/report.md`.

**Staged fingerprints.** `Orchestrator.fingerprints(urls)` hashes, per phase, the inputs that phase
depends on (cumulatively): 1 URLs + acquisition settings · 2 chhapify · 3 feature-map.json + Clooney ·
5 artist.json + content settings + language · 6 design-briefs.json + variations + generation +
json-render settings + the brief prompts · 7 facelift · 8 packaging. `Checkpoint.open` re-runs from
the first phase whose hash changed (phase 1 → a fresh run) and keeps everything before it.

---

## 4. Template contract (`templates/`)

### 4.1 Per-brief deliverables (`templates/briefs/<briefId>/`)
- `components/<Name>.tsx` for the 10 signature components every brief draws itself — `NavBar, Hero,
  Biography, Discography, TopSongs, TourDates, PressQuotes, Newsletter, SocialLinks, Footer` —
  `export default function <Name>(props: <Name>Props)`.
- The other 7 section components (`StatsBand, VideoGallery, PhotoGallery, MusicPlayer, ContactBooking,
  FeatureSection, SectionDivider`) are shared (`templates/shared/components/`) and take each brief's
  look from "skin" classes: `skin-section, skin-container, skin-eyebrow, skin-title, skin-lead,
  skin-card, skin-media, skin-btn, skin-btn-ghost, skin-chip, skin-link, skin-muted` and the
  `divider-*` variants. `templates/shared/styles/skin-base.css` holds neutral defaults; the brief's
  `styles.css` (appended after it) overrides them. A brief can still replace any shared component by
  shipping a file with the same name.
- `styles.css` — brief-specific CSS appended to the generated globals.css (skin overrides, keyframes,
  `@utility` classes, grain/glass/marquee helpers, base element styles). Colors only via theme variables.
- `manifest.json` — `{ "briefId", "components": [all 17 names], "variants": { "<Component>": ["default", ...] }, "notes" }`.
  `variants[C][0]` is the default value for that component's `variant` prop (for `Discography` the
  list holds supported `layout` values). Must list `Hero` (≥ 2), `Discography` (≥ 2 layouts),
  `TopSongs`, `TourDates`, `PressQuotes`, `SectionDivider` (the divider variant(s) the brief draws).
- `prompts/design-brief-0N-<slug>.md` — the opinionated design brief (structure in CLAUDE.md, Phase 5).

### 4.2 Components and props (exact types in `templates/shared/lib/types.ts`)
`NavBar, Hero, StatsBand, Biography, Discography, TopSongs, TourDates, VideoGallery, PhotoGallery,
MusicPlayer, PressQuotes, Newsletter, SocialLinks, ContactBooking, FeatureSection, SectionDivider, Footer`.

### 4.3 Available imports in a generated site
- `@/lib/types` (all types), `@/lib/utils` (`cn, linkAttrs, linkItemAttrs, isExternal, formatEventDate,
  formatDuration, take, initials, youtubeThumbnail, youtubeEmbedUrl, spotifyArtistEmbedUrl,
  sortSocialLinks, streamingLinks, socialOnlyLinks, isValidEmail`), `@/lib/i18n` (`t, LANG, LOCALE,
  albumTypeLabel, eventStatusLabel`), `@/lib/use-audio-preview` (`useAudioPreview`), `@/lib/theme`
  (`theme` raw values), `@/lib/content` (`artistContent` — avoid in components; use props).
- `@/components/BrandIcons` (`BrandIcon, platformLabel`), `@/components/SmartImage`,
  `@/components/LiteYouTube`, `@/components/ui/{button,card,badge,input}` (shadcn/ui).
- npm: `react`, `next` (`next/image`, `next/link`), `framer-motion`, `lucide-react` (1.x — **no brand icons**),
  `clsx`, `tailwind-merge`, `class-variance-authority`. **No other packages.**

### 4.4 Styling contract
- Tailwind v4 utilities mapped to theme variables: colors `background, foreground, surface(+-foreground),
  muted(+-foreground), primary(+-foreground), secondary(+-foreground), accent(+-foreground), card,
  popover, destructive, border, input, ring, glow, overlay, gradient-from/-via/-to` (opacity modifiers
  work: `bg-primary/20`); fonts `font-display font-body font-mono`; radii `rounded-sm rounded rounded-lg`
  → `--radius-*`; shadows `shadow-sm shadow shadow-md shadow-lg` → brief shadow style;
  `max-w-container`; `py-section` (section spacing). Raw variables (`var(--glass-blur)`,
  `var(--grain-opacity)`, `var(--shadow-color)`…) are fine in styles.css / arbitrary values.
- Never hard-code colors (no hex/rgb in components or styles.css except pure black/white where the brief
  is literally monochrome-brutalist); the palette is generated per run from extracted tokens.
- Contrast: body text uses `text-foreground`/`text-muted-foreground`; `text-accent` on `bg-background`
  is fine except in Brutalist (accent there is a *block* color: `bg-accent text-accent-foreground`).

### 4.5 Behavior rules (every component)
- `"use client"` only where needed (hooks, framer-motion, event handlers).
- Section components render `<section id={anchorId} …>`; NavBar renders `<header>`/`<nav>`; Footer `<footer>`.
- Mobile-first; no horizontal overflow at 360px; tap targets ≥ 44px; fluid type with `clamp()`.
- Motion: framer-motion; `whileInView` with `viewport={{ once: true, amount: 0.2 }}`; honor
  `useReducedMotion()` (render the final state); no content may stay invisible if JS animations fail.
- All visible text comes from props, content data or `t()` — **never hard-code artist facts or names**.
- Empty data → graceful empty state (`t("emptyVideos")` etc. or props like `emptyTitle`), never a crash.
  `TourDates` with no events shows `emptyTitle`/`emptyMessage` + tickets/newsletter CTA — never fake dates.
- Links: `linkAttrs(href)` (external → new tab + rel). Images: `SmartImage`. YouTube: `LiteYouTube`.
  Spotify: `spotifyArtistEmbedUrl(id)` iframe (`loading="lazy"`, `title`). Audio previews: `useAudioPreview`.
- Newsletter: client-side validation (`isValidEmail`), simulated async submit (~700ms), success/error
  states from props, `aria-live` region; no network call (front-end mock; documented in RUN.md).
- Footer always renders `credits` (content & image attribution) and `copyright`.
- Accessibility: semantic landmarks, alt text, `aria-label`s, focus-visible styles, keyboard-operable
  menus/carousels, `prefers-reduced-motion`.

### 4.6 Adding or changing a brief
1. Add an entry to `config/design-briefs.json` (id, projectName, fonts, palette strategy, radius,
   shadows, motion preset, section order, divider placement, json-render rules, es/en microcopy).
   Palette strategies live in `src/generators/theme-generator.ts`.
2. Write `prompts/design-brief-0N-<slug>.md` (Visual Direction, Typography, Color Palette, Layout
   Rules, Component Styling, Animation Style, Do NOT). Every brief listed in the config needs its
   prompt file — the factory refuses to start without it.
3. Create `templates/briefs/<id>/` with `manifest.json`, `styles.css` and the 10 signature components.
   Copy an existing brief as a starting point; props are typed in `templates/shared/lib/types.ts`.
4. Regenerate with `npm start -- --from 6` (phases 1–5 are reused from `artifacts/`). The packager
   type-checks and builds every site, so template mistakes show up in
   `artifacts/build-logs/<project>.log`.
