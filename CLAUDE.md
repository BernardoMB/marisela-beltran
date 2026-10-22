# CLAUDE.md — Automated Artist Website Factory

> **Implementation notes (authoritative where they conflict with the original specification below).**
> The binding module contract is `docs/ARCHITECTURE.md`. Verified facts about the external tools, as built:
>
> - **chhapify** (npm, v1.0.0) — used as specified (`chhapify <url> --full --out <dir> --name <slug> --no-history`),
>   run from the local install so it never hits the registry. Its Playwright dedupes with ours (Chromium installed by `postinstall`).
> - **Clooney-Agent** — `github.com/saksham-shr/Clooney-Agent` does not exist (404; the account has no such repo).
>   "Clooney" was a web-app-cloning assignment; the only general-purpose public implementation is
>   `github.com/s4sachin/agent-clooney` (Gemini vision, `VLMAnalysisAgent.analyzePageVisuals()` → `ComponentSpec[]`).
>   The factory tries the configured repos in order (spec repo first), pins the commit, runs the VLM agent headlessly,
>   and always runs its own Playwright DOM analyzer as the baseline. Needs `GEMINI_API_KEY`; skipped gracefully otherwise.
> - **json-render** (`@json-render/core` + `@json-render/react` 0.21.1) — catalog, `catalog.prompt()`, `buildUserPrompt`,
>   `compileSpecStream`, `catalog.validate`, `validateSpec`/`autoFixSpec` are used for real. It requires **zod v4**
>   (peer dependency), so the root uses `zod@^4` instead of the `^3.23` listed below. json-render's default prompt asks
>   models to invent sample state; the factory forbids that and discards any model-emitted `/state`.
> - **LLM** — Claude via the Anthropic SDK when `ANTHROPIC_API_KEY` is set, otherwise the local Claude Code CLI
>   (`claude -p`, no key needed), otherwise a deterministic generator. Defaults use Sonnet at low effort
>   for one sequential page-composition call per site, with no repair retry; biography polishing and
>   site-facelift AI reviews are off to limit usage. If Claude becomes unavailable, remaining sites use
>   the deterministic composer. `--no-ai` forces deterministic mode.
> - **site-facelift** (PyPI, v0.1.2) — its CLI only accepts a URL; there is **no `validate --project` command**.
>   The factory installs it into `vendor/facelift-venv` and drives its real modules through `scripts/facelift_bridge.py`:
>   the crawler (phase 1 acquisition), `VALIDATION_PROMPT`/`CLEANUP_PROMPT` + `run_claude` (phase 7 AI review, which needs
>   the `claude` CLI), and its sentinel pattern (checkpointing). A mechanical validator always runs.
> - **Generated sites**: Next.js 15.5 (App Router) + React 19.1 + Tailwind CSS v4 (`@config "../tailwind.config.ts"`) +
>   shadcn/ui copy-in primitives + Framer Motion + lucide-react, `"type": "module"`. Components live in the project-root
>   `components/` directory (the Phase 9 layout), not `app/components/`.
> - **Templates**: each design brief draws its 10 signature components itself (`templates/briefs/<id>/components/`:
>   nav, hero, biography, discography, top songs, tour dates, press, newsletter, social, footer). The 7 secondary sections
>   (stats, videos, photo gallery, player, contact, extra features, dividers) are shared components restyled per brief
>   through `skin-*` CSS classes (`templates/shared/styles/skin-base.css` + each brief's `styles.css`). See `docs/ARCHITECTURE.md` §4.
> - **Artist facts**: the "Known facts" listed below are *claims to verify*, not facts. Several contradict public sources
>   (e.g. Wikidata/MusicBrainz give a 1966 birth in Los Angeles and the name Marisela Esqueda; a 1987 birth is incompatible
>   with a 1984 debut). The content synthesizer fetches everything at runtime, records provenance per field, and publishes
>   a claim only if a fetched source corroborates it (see `config/artist.json` → `claimsToVerify` and the claims table in
>   `artifacts/report.md`). The display name comes from sources unless `displayNameOverride` is set.
>
> - **Running it**: `/generate-websites --urls <url1> <url2> …` (project command in `.claude/commands/`) or
>   `npm run generate-websites -- --urls …`. URLs given this way are saved to `config/urls.txt`; the CLI refuses to start
>   while that file only holds the shipped example addresses. A full run is long (15–40 min): start it in the background.
> - **Nested Claude calls** (page composition, biography, site-facelift review) run `claude -p` with a clean environment —
>   the parent Claude Code session's variables (notably `CLAUDE_EFFORT`) are stripped — and an explicit model/effort.
>   A session/usage-limit or auth error switches Claude off for the rest of the run (deterministic fallbacks finish it).
>
> Dev-only scratch space: `.sandbox/` (gitignored). Never commit secrets; `.env` is gitignored.

---

## Project Overview

You are building **`artist-site-factory`**, a fully automated multi-agent pipeline that transforms a list of inspirational website URLs into a set of unique, runnable Next.js front-end projects for Mexican singer **Marisela Beltrán**.

The user's only input is a text file containing inspirational URLs. The user's only output expectation is a `generated-websites/` directory containing multiple Next.js projects, each with `node_modules` already installed, ready to run with `npm run dev`.

**Your job is to build the repo that makes this happen with zero human intervention after the URL list is provided.**

---

## Repository Structure

```
artist-site-factory/
├── CLAUDE.md                     # This file
├── package.json                  # Root orchestrator package
├── tsconfig.json
├── .env.example                  # API keys template
├── .gitignore
├── README.md                     # User-facing instructions
│
├── config/
│   ├── urls.txt                  # User provides inspirational URLs here
│   ├── design-briefs.json        # 6 distinct design briefs for variation
│   └── feature-map.json          # Maps extracted features to component templates
│
├── src/
│   ├── index.ts                  # Main entrypoint — run this
│   ├── orchestrator.ts           # Master pipeline coordinator
│   │
│   ├── agents/
│   │   ├── planner.ts            # Decomposes pipeline into tasks
│   │   ├── design-extractor.ts   # Runs chhapify on each URL
│   │   ├── feature-inventory.ts  # Runs Clooney-Agent analysis
│   │   ├── content-synthesizer.ts # Fetches Marisela Beltrán data
│   │   ├── ui-generator.ts       # Invokes json-render for each variation
│   │   ├── validator.ts          # Runs site-facelift validation
│   │   └── packager.ts           # npm install + final checks
│   │
│   ├── tools/
│   │   ├── run-chhapify.ts       # Wrapper for chhapify CLI
│   │   ├── run-clooney.ts        # Wrapper for Clooney-Agent
│   │   ├── run-json-render.ts    # Wrapper for json-render generation
│   │   ├── run-facelift.ts       # Wrapper for site-facelift validation
│   │   └── run-content-fetch.ts  # Wrapper for Marisela content scraping
│   │
│   ├── generators/
│   │   ├── nextjs-scaffold.ts    # Generates base Next.js project structure
│   │   ├── component-registry.ts # Component catalog for json-render
│   │   ├── theme-generator.ts    # Generates unique Tailwind themes
│   │   └── content-injector.ts   # Maps Marisela content into components
│   │
│   ├── schemas/
│   │   ├── feature-manifest.ts   # Zod schema for feature manifests
│   │   ├── design-tokens.ts      # Zod schema for design tokens
│   │   └── content-schema.ts     # Zod schema for Marisela content
│   │
│   └── utils/
│       ├── logger.ts
│       ├── file-utils.ts
│       └── shell.ts
│
├── prompts/
│   ├── design-brief-01-minimalist.md
│   ├── design-brief-02-bold.md
│   ├── design-brief-03-editorial.md
│   ├── design-brief-04-glassmorphism.md
│   ├── design-brief-05-brutalist.md
│   └── design-brief-06-retro.md
│
├── generated-websites/           # OUTPUT — created at runtime
└── artifacts/                    # Intermediate outputs
    ├── design-tokens/
    ├── feature-manifests/
    ├── marisela-content/
    └── validation-reports/
```

---

## Phase 1: Repository Bootstrap

### Step 1.1 — Initialize the root package

Create `package.json` with: name `artist-site-factory`, `"type": "module"`, scripts `start` (`tsx src/index.ts`), `build` (`tsc`), `dev` (`tsx watch src/index.ts`); dependencies zod, execa ^9, fs-extra ^11.2, chalk ^5.3, ora ^8, dotenv ^16.4, p-limit ^6; devDependencies typescript ^5.5, tsx ^4.19, @types/fs-extra, @types/node ^22.

### Step 1.2 — Create `.env.example`

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

### Step 1.3 — Create `config/urls.txt` with placeholder

```
# Add one inspirational artist website URL per line
https://example-artist-1.com
https://example-artist-2.com
```

---

## Phase 2: Orchestrator Entrypoint

### Step 2.1 — Build `src/index.ts`

This is the single command the user runs: `npm start`. It must:

1. Read `config/urls.txt` — parse out all non-comment lines.
2. Validate that at least 1 URL is present.
3. Instantiate the `Orchestrator` class.
4. Call `orchestrator.run(urls)`.
5. Log a final summary: number of generated projects, their paths, and the exact `cd <path> && npm run dev` command for each.

### Step 2.2 — Build `src/orchestrator.ts`

The `Orchestrator` class coordinates the sequential pipeline with a state machine and checkpoint/resume capability (writes `.orchestrator-state.json` after each phase):

```
PHASE_1_ACQUISITION       → Download & cache each URL's HTML/JS/CSS
PHASE_2_DESIGN_EXTRACTION → Run chhapify per URL
PHASE_3_FEATURE_INVENTORY → Run Clooney-Agent per URL
PHASE_4_FEATURE_UNION     → Compute union of all feature manifests
PHASE_5_CONTENT_SYNTHESIS → Fetch & structure Marisela Beltrán content
PHASE_6_UI_GENERATION     → Generate N unique Next.js projects
PHASE_7_VALIDATION        → Validate each generated project
PHASE_8_PACKAGING         → npm install + final integrity check
PHASE_9_REPORT            → Write summary report
```

For each phase, log progress with `ora` spinners. On failure, log the error and write a `STEPN_FAILED` sentinel file, then exit with code 1.

---

## Phase 3: Agent Implementations

### Step 3.1 — Design Extraction Agent (`src/agents/design-extractor.ts`)
Tool: `chhapify`. Run `npx chhapify <url> --full --out <outputDir>`, which produces `<name>-design-language.md`, `<name>-design-tokens.json` (W3C), `<name>-tailwind.config.js`, `<name>-variables.css`, `<name>-theme.js`, `<name>-shadcn-theme.css`, `<name>-preview.html`, `<name>-figma-variables.json`. Parse the design tokens into our schema. Output: `artifacts/design-tokens/<slug>/` with all chhapify outputs plus a parsed `tokens.json` conforming to `src/schemas/design-tokens.ts`.

### Step 3.2 — Feature Inventory Agent (`src/agents/feature-inventory.ts`)
Tool: Clooney-Agent (see implementation notes). Clone into `vendor/clooney-agent` if not present, run its analysis pipeline against the URL (Playwright + AI), extract its component inventory, normalize into our `FeatureManifest` schema. Output `artifacts/feature-manifests/<slug>.json`; each feature: `{ id, type, name, description, layout, components[], interactions[] }`.

### Step 3.3 — Feature Union Computation
Load all manifests, merge by `type` (superset features), write `artifacts/feature-manifests/UNION.json`, log `Union contains N unique feature types: [list]`.

### Step 3.4 — Content Synthesis Agent (`src/agents/content-synthesizer.ts`)
Fetch and structure all available information about the artist (headless browser + public APIs: SoundCharts, Ticketmaster, Wikipedia, official social media). Claims supplied with the original brief (to be verified, see notes): real name "Marisela Beltrán Rivera"; born September 20, 1987, Mazatlán, Sinaloa; alias "La Dama de Hierro"; Mexican-American singer and actress; 40+ million albums from 16+ productions; 750,000,000+ Spotify streams; ~4.5M (SoundCharts) / ~5.4M (Spotify) monthly listeners; albums *Sin él* (1984), *Completamente Tuya* (1985), *Porque Tengo Ganas* (1989), *Marisela* (1989), *Hombres Como Tu* (1989), *Hablemos Claro* (1990), *Con Banda Sinaloense* (1990), *Adios Amor* (1996), *Borrón y Cuenta Nueva* (1998), *Voz y Sentimiento* (1999), *Canciones de Amor* (2012), *Dos almas* (2023); songs "Mi problema", "Enamorada y herida", "Sin él", "Completamente tuya", "Sola con mi soledad", "El chico aquel", "Tu dama de hierro", "La pareja ideal", "Si no te hubieras ido"; Billboard feat (every track of *Sin él* in Billboard's Top 10, 1984); tours "Con Amor World Tour" (2024), "Eterna Tour" (2026). Output `artifacts/marisela-content/content.json` conforming to `src/schemas/content-schema.ts` with `biography`, `discography[]`, `topSongs[]`, `tourDates[]`, `socialLinks`, `pressQuotes[]`, `stats{}`.

### Step 3.5 — UI Generation Agent (`src/agents/ui-generator.ts`)
Tool: json-render (Vercel Labs). Build a component catalog (`src/generators/component-registry.ts`) mapping every feature in the UNION to a renderable React component with typed props. For each of the 6 design briefs run json-render with the full content as data, the design tokens from a randomly selected inspiration URL, the brief prompt and the catalog as constraint set. json-render outputs a JSON spec; a renderer converts it into Next.js pages and components.

| # | Brief | Key Characteristics |
|---|-------|---------------------|
| 1 | Minimalist | White space, thin typography, monochrome palette, grid-based |
| 2 | Bold & Colorful | Vibrant gradients, large type, overlapping elements, dynamic |
| 3 | Editorial | Magazine-style, asymmetric layout, serif display fonts |
| 4 | Glassmorphism | Frosted glass panels, blur effects, soft gradients |
| 5 | Brutalist | Raw HTML aesthetic, monospace, harsh borders, high contrast |
| 6 | Retro/Vintage | Warm tones, grain texture, retro typography, nostalgic |

### Step 3.6 — Validator Agent (`src/agents/validator.ts`)
Tool: site-facelift ("a mechanical validation pass checks for typos, broken links, and image misuse; a final Claude step applies obvious fixes and logs judgment calls for human review"). Validate each generated project, parse `validation.md`, apply auto-fixable fixes, write `artifacts/validation-reports/<project>.md`.

### Step 3.7 — Packager Agent (`src/agents/packager.ts`)
For each project: `npm install --prefer-offline`, `npm run build`, auto-fix common failures, keep `node_modules`, write `RUN.md` with the exact command.

---

## Phase 4: Next.js Scaffold Generator

`src/generators/nextjs-scaffold.ts` generates a complete Next.js 15 project: App Router, TypeScript, Tailwind CSS v4, shadcn/ui (via chhapify's `shadcn-theme.css`), Framer Motion, Lucide React; files `package.json`, `next.config.js`, `tailwind.config.ts`, `tsconfig.json`, `postcss.config.js`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, components `Hero, Discography, TourDates, Biography, TopSongs, SocialLinks, PressQuotes, Newsletter, Footer`, `lib/content.ts`, `public/images/`.

Each component must accept typed props from `lib/content.ts`, use Tailwind classes referencing the extracted design tokens, be responsive (mobile-first), include Framer Motion animations, and be unique per design brief.

---

## Phase 5: Design Brief Prompts

Each `prompts/design-brief-0N-*.md` follows:

```markdown
# Design Brief: {NAME}

You are generating a website for Mexican singer Marisela Beltrán, "La Dama de Hierro."

## Visual Direction
## Typography
## Color Palette        (derived from extracted tokens, but transformed per brief)
## Layout Rules
## Component Styling    (Hero, Discography, Tour Dates, Biography)
## Animation Style
## Do NOT
```

The 6 sites must look nothing like each other.

---

## Phase 6: Content Injection

`src/generators/content-injector.ts` turns `artifacts/marisela-content/content.json` into each project's `lib/content.ts` (`export const artistContent = { name, aliases, tagline, biography, discography, topSongs, tourDates, stats, socialLinks, pressQuotes, … }`).

## Phase 7: AgentMesh Pattern

| AgentMesh Role | Implementation |
|----------------|----------------|
| Planner | `src/agents/planner.ts` — reads URL list, creates task graph (`artifacts/task-graph.json`) |
| Coder | `src/agents/ui-generator.ts` — generates code via json-render |
| Debugger | `src/agents/validator.ts` — validates & fixes |
| Reviewer | `src/agents/packager.ts` — final integrity check |

## Phase 8: Resumability & Checkpointing

`src/utils/checkpoint.ts` — `STEP1_COMPLETED` … `STEP8_COMPLETED` sentinels at the run root (site-facelift pattern); re-running `npm start` resumes from the last incomplete step (and from the last incomplete project within a step).

## Phase 9: Final Output Structure

```
generated-websites/
├── marisela-site-01-minimalist/   (app/ components/ lib/ public/ package.json tailwind.config.ts node_modules/ RUN.md)
├── marisela-site-02-bold/
├── marisela-site-03-editorial/
├── marisela-site-04-glassmorphism/
├── marisela-site-05-brutalist/
└── marisela-site-06-retro/
```

## Phase 10: Error Handling & Logging

`chalk` + `ora` on the console; full log in `factory.log` (`[2026-01-15T10:23:45Z] [INFO] …`). Graceful degradation: chhapify failure → default tokens; Clooney failure → baseline features (hero, discography, tour dates, bio, social links). Never fail the whole pipeline because one URL failed.

## Phase 11: README.md

User-facing: what it does, prerequisites (Node.js 20+, npm, optional API keys), setup, `npm start`, output, configuration (variations, adding briefs), troubleshooting.

## Critical Constraints

1. Zero human intervention after the URL list is provided.
2. Every generated site must be visually unique (layout, palette, typography).
3. Every generated site must include the union of all features.
4. Every generated site must be immediately runnable (`npm run dev`).
5. The system must be resumable.
6. No hardcoded content — all artist content is fetched at runtime from public sources.
7. Use the real tools (chhapify, Clooney-Agent, json-render, site-facelift).
8. Log everything — `factory.log` alone must be enough to diagnose failures.
