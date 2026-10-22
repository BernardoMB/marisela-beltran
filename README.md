# Artist Site Factory

Give this tool a list of artist websites you like, and it builds **six complete, ready-to-run websites**
for the Mexican singer **Marisela Beltran**, each one in a completely different visual style (Minimalist, Bold &
Colorful, Editorial, Glassmorphism, Brutalist and Retro). It studies the design and features of the
sites you list, gathers real, verified information about the artist from public sources (biography,
albums, songs, videos, photos, social links), and writes six Next.js projects into the
`generated-websites/` folder — with all their dependencies already installed. You only give it the
addresses of the sites you like, with one command:

```bash
npm run generate-websites -- --urls https://first-artist.com https://second-artist.com
```

or, inside Claude Code, `/generate-websites --urls https://first-artist.com https://second-artist.com`.

---

## 1. What you need

| Requirement | Needed? | What it is for |
|---|---|---|
| **Node.js 20 or newer** (includes `npm`) | **Required** | Runs the factory and the generated websites. Download from <https://nodejs.org> (choose "LTS"). |
| **Internet connection** | **Required** | The factory visits the inspiration sites and fetches artist information. |
| **Git** | Recommended | Downloads Clooney-Agent (the component-analysis tool). |
| **Python 3.10 or newer** | Optional | Runs *site-facelift*, used to crawl the inspiration sites and to review the generated sites. |
| **Claude Code** (`claude` command) **or** an Anthropic API key | Optional | Lets Claude design each page layout with json-render and polish the biography. Without it, a built-in designer is used. |
| **Gemini API key** | Optional | Enables Clooney-Agent's AI analysis of each inspiration site's components. |
| **Ticketmaster API key** | Optional | Finds real upcoming concert dates. Without it, the sites show a tasteful "dates coming soon" section. |

Everything optional degrades gracefully: the factory always finishes and always produces six working sites.

To check Node.js is installed, open a terminal (Windows: *PowerShell* or *Terminal*; Mac: *Terminal*) and run:

```bash
node --version     # should print v20 or higher
```

---

## 2. One-time setup

Open a terminal **in this folder** and run:

```bash
npm install
```

This installs the factory's tools and downloads a headless Chromium browser (about 150 MB). It takes a
few minutes the first time.

**Optional — add API keys.** Copy the example settings file and fill in any keys you have:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env
# Mac / Linux
cp .env.example .env
```

Open `.env` in any text editor. Every key is optional (see the table above). Never share this file.

---

## 3. Generate the websites

Pick the inspiration websites — artist sites whose design or features you like — and run **one** of:

**In a terminal** (in this folder):

```bash
npm run generate-websites -- --urls https://www.shakira.com https://www.taylorswift.com
```

**In Claude Code** (opened in this folder):

```text
/generate-websites --urls https://www.shakira.com https://www.taylorswift.com
```

Claude starts the run in the background, waits for it and summarizes the result when it finishes.

**Or with the URL file:** put the addresses in **`config/urls.txt`** (one per line; lines starting with
`#` are ignored) and run `npm start`.

Addresses can be written without `https://`. One URL is enough; more URLs give the factory more designs
and features to learn from. URLs given with `--urls` are saved to `config/urls.txt` (the previous list
is kept in `config/urls.previous.txt`), so a later `npm start` resumes or repeats the same run. Sites that
block automated visitors or are unreachable are skipped with a warning — the run continues. The factory
refuses to start while `config/urls.txt` only has the example addresses it ships with.

---

## 4. While it runs

No further input is needed. The terminal shows each step with a spinner, for example:

```
✔ Phase 1/9: Acquire inspirational sites (HTML/CSS/JS + DOM snapshot)
✔ Phase 2/9: Extract design systems (chhapify)
✔ Phase 3/9: Build feature inventories (Clooney-Agent + DOM analyzer)
✔ Phase 4/9: Compute feature union
✔ Phase 5/9: Synthesize artist content from public sources
✔ Phase 6/9: Generate Next.js projects (json-render)
✔ Phase 7/9: Validate projects (site-facelift)
✔ Phase 8/9: Install, build and package projects
✔ Phase 9/9: Write summary report
```

A full run usually takes **15–40 minutes** without AI (most of it is acquiring references and
installing/building the six sites). With AI enabled, the six sequential page-composition calls add
time depending on provider response times; validation itself stays mechanical. The
first run on a computer is slower (npm downloads, one-time site-facelift setup). When it finishes, it
prints the six projects and the exact command to start each one.

**What uses Claude.** Unless `--no-ai` is specified, the pipeline can use Claude to compose the
pages with json-render. The defaults use Sonnet at low effort, make one composition attempt per
site, and run those attempts sequentially. Site-facelift's AI review is off by default; its
mechanical validation still runs. AI biography polishing is also off by default. This keeps the
expensive work focused on generating the pages.
Through Claude Code, composition uses your Claude plan. If Claude hits a usage or session limit,
the factory stops making AI calls and finishes the remaining sites with its built-in deterministic
composer. This fallback protects completion, but no configuration can guarantee that a provider
will not impose a usage limit. Add `--no-ai` to skip model calls entirely.

---

## 5. Look at your websites

Each site is a separate folder in `generated-websites/`:

```
generated-websites/
├── marisela-site-01-minimalist/
├── marisela-site-02-bold/
├── marisela-site-03-editorial/
├── marisela-site-04-glassmorphism/
├── marisela-site-05-brutalist/
└── marisela-site-06-retro/
```

To open one, run the two commands printed at the end of the run, for example:

```bash
cd generated-websites/marisela-site-01-minimalist
npm run dev
```

Then open **<http://localhost:3000>** in your browser. Press `Ctrl + C` in the terminal to stop it.
Each folder also has a `RUN.md` with these instructions, and `node_modules/` is already installed —
no extra setup is needed. To run a second site at the same time, use another port:
`npm run dev -- --port 3001`.

**Publishing a site.** Each project is a standard Next.js app: `npm run build && npm start` runs the
production version, and the folder can be deployed as-is to Vercel, Netlify or any Node.js host.

---

## 6. What the factory produced (and how to check it)

| Where | What |
|---|---|
| `generated-websites/<site>/` | The six websites (`app/`, `components/`, `lib/content.ts`, `public/images/`, `RUN.md`, …). |
| `artifacts/report.md` | **Start here.** A readable summary of the whole run: inspiration sites, extracted designs, detected features, content sources, fact checks, per-site styles, validation and build results. |
| `artifacts/design-tokens/<site>/` | The design system chhapify extracted from each inspiration site. |
| `artifacts/feature-manifests/` | Features found on each inspiration site, and `UNION.json` — the features every generated site includes. |
| `artifacts/marisela-content/content.json` | All artist content, with the source of every fact. |
| `artifacts/validation-reports/<site>.md` | Quality check of each site (typos, broken links, image problems). |
| `artifacts/ui-specs/` | The json-render page specifications (and the AI prompts, when AI was used). |
| `artifacts/task-graph.json` | The plan the factory followed (AgentMesh-style task graph). |
| `factory.log` | Every step in detail — the first place to look if something went wrong. |

**Every generated site includes every feature found across your inspiration sites** (for example, if
one of them has a newsletter signup, all six sites get one), in its own visual style.

---

## 7. Where the artist information comes from

Nothing about the artist is typed into the code. On every run the factory fetches it from public
sources — Wikidata, Wikipedia (Spanish and English), MusicBrainz, Deezer, Apple/iTunes, the artist's
official site, YouTube, Wikimedia Commons and Spotify's public page — and records which source each
fact came from.

**Fact checking.** `config/artist.json` lists claims to check (sales figures, birth date, tours, …).
A claim is shown on the sites **only if a fetched source confirms it**. The claims table in
`artifacts/report.md` shows which claims were confirmed, which could not be confirmed, and which
contradict the sources (for example, public sources give the artist's name as *Marisela* — born
Marisela Esqueda in Los Angeles in 1966 — rather than "Marisela Beltrán").

**Changing the displayed name.** By default the name comes from the sources. To force a different name,
set `"displayNameOverride"` in `config/artist.json`, e.g. `"displayNameOverride": "Marisela Beltrán"`.

**Tour dates are never invented.** If no real upcoming dates are found (add a `TICKETMASTER_API_KEY` to
search Ticketmaster), the tour section shows a "dates coming soon" message with links to tickets and the
newsletter.

**Licenses.** Biography text taken from Wikipedia is CC BY-SA 4.0 and is credited in each site's footer;
photos from Wikimedia Commons are credited with their license; album covers belong to their respective
owners. Review the content before publishing a site publicly.

---

## 8. Stopping, resuming and re-running

- **Resume after a crash or interruption:** run `npm start` (or `/generate-websites` without `--urls`)
  again. Finished steps are skipped automatically (the factory leaves `STEP1_COMPLETED` …
  `STEP8_COMPLETED` marker files in this folder), and within a step, finished sites are skipped too.
- **Start over completely:** `npm start -- --fresh`
- **Re-run from a specific step** (for example, regenerate the websites but keep the research):
  `npm start -- --from 6`
- **Changed settings re-run only the steps they affect**, automatically: a different `config/urls.txt`
  starts over; editing `config/artist.json` refreshes the artist content and everything after it;
  editing `config/design-briefs.json`, a `prompts/` file or the number of variations regenerates the
  websites but reuses the research (steps 1–5).
- **Delete everything generated** (sites, artifacts, logs, markers): `npm run reset`

### Command options

Options go after `--`, e.g. `npm start -- --from 6 --verbose`.

| Option | Effect |
|---|---|
| `--urls <url1> <url2> …` | The inspiration websites (saved to `config/urls.txt`). |
| `--urls <file>` | Read inspiration URLs from another file instead. |
| `--no-ai` | Never call Claude: built-in page designer, no AI review. |
| `--fresh` | Ignore previous progress and start from step 1. |
| `--from <n>` | Re-run from step `n` (1–9) onwards, e.g. `--from 6` to recompose the sites. |
| `--variations <n>` | Generate only the first `n` design briefs (1–6). |
| `--verbose` | Show detailed tool output in the terminal (it is always in `factory.log`). |
| `--reset` | Same as `npm run reset`. |
| `--help` | Show the options. |

---

## 9. Configuration

All settings live in `config/` — no code changes needed.

| File | What you can change |
|---|---|
| `config/urls.txt` | The inspiration websites. |
| `config/factory.config.json` | `variations` (how many sites, 1–6), `siteLanguage` (`es` or `en`), `llm.provider` (`auto`, `api`, `cli`, `off`), the Claude model/effort/output-token/retry limits for page composition, the site-facelift AI review switch (off by default), tool switches (`tools.chhapify`, `tools.clooney`), parallelism (`concurrency`), timeouts, and the exact Next.js/React versions of the generated sites. |
| `config/design-briefs.json` | The six design briefs: fonts, color strategy, section order, wording of buttons and headings (Spanish and English). |
| `config/feature-map.json` | Which website features are recognized and which component renders each one. |
| `config/artist.json` | Who the artist is (lookup IDs), the displayed-name override, and the claims to fact-check. |
| `prompts/design-brief-0N-*.md` | The written art direction for each style (also given to Claude when AI design is on). |
| `.env` | Optional API keys (see `.env.example`). |

**How the AI is chosen (`llm.provider`).** `auto` (default) uses the Anthropic API when
`ANTHROPIC_API_KEY` is set, otherwise the Claude Code command-line tool if it is installed and logged in,
otherwise no AI. With AI enabled, Claude composes each page from the component catalog with json-render
(section order, layout variants and wording); by default the six calls are sequential, use Sonnet at low
effort, allow no repair retries, and cap API output at 8,192 tokens per call. The CLI honors the model
and effort settings; the API output cap applies to API requests, and API provider errors are not
automatically retried. Biography polishing and site-facelift's AI review are off by default. Without
an available AI provider (or with `--no-ai`), a deterministic
designer produces the same kind of page from the brief's settings. If Claude becomes unavailable
mid-run, remaining pages use that fallback. Either way, only real, fetched content is used.

**Adding a seventh style.** Add an entry to `config/design-briefs.json`, write
`prompts/design-brief-07-<name>.md`, create `templates/briefs/07-<name>/` with the components
(see `templates/briefs/01-minimalist/` and `docs/ARCHITECTURE.md` §4), a `styles.css` and a
`manifest.json`, then set `"variations": 7`.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| `node` or `npm` is not recognized | Install Node.js 20+ from <https://nodejs.org> and open a new terminal. |
| "No inspiration websites yet" | Give the factory some sites: `npm run generate-websites -- --urls <url1> <url2>` (or edit `config/urls.txt`). |
| "Claude is unavailable for the rest of this run" | Claude hit a usage/session limit or a login problem. The run finishes without AI; once Claude is available again, `npm start -- --from 6` recomposes the sites with Claude. |
| "Executable doesn't exist" / Chromium errors | Run `npx playwright install chromium`. |
| A site in `urls.txt` shows "skipped" or "degraded" | It blocked automated visitors or was unreachable. The run continues with the other sites (or with default design settings). Try another URL. |
| "No LLM provider available" | Normal without an API key or Claude Code — the built-in designer is used. Add `ANTHROPIC_API_KEY` to `.env` or install Claude Code to enable AI page design. |
| "site-facelift unavailable" | Python 3.10+ isn't installed or isn't on PATH. The built-in validator still runs. |
| "Clooney-Agent skipped" | Add a `GEMINI_API_KEY` to `.env` (and make sure Git is installed). The built-in analyzer still runs. |
| npm warnings like "install-scripts … not yet covered by allowScripts" | Harmless — npm 11 holds back optional install scripts; the sites work without them. |
| `Port 3000 is in use` | Another site is running. Stop it with `Ctrl + C`, or run `npm run dev -- --port 3001`. |
| A website failed to build | See `artifacts/build-logs/<site>.log` and `artifacts/report.md`. Re-run with `npm start -- --from 6`. |
| Fonts look plain | The sites download Google Fonts on first start; check your internet connection. |
| Paths too long (Windows) | Move this folder closer to the drive root (e.g. `C:\sites\factory`). |
| Anything else | Open `factory.log` — every step and every tool's output is recorded there. |

---

## 11. For developers

- Entry point: `src/index.ts` → `src/orchestrator.ts` (nine-phase state machine with checkpoints).
- Agents (`src/agents/`): planner, site acquirer, design extractor (chhapify), feature inventory
  (Clooney-Agent + DOM analyzer), content synthesizer, UI generator (json-render), validator
  (site-facelift), packager, reporter. Tool wrappers in `src/tools/`, generators in `src/generators/`,
  Zod schemas in `src/schemas/`.
- Templates for the generated sites: `templates/shared/` (types, utilities, shadcn/ui primitives) and
  `templates/briefs/<id>/` (one component set per style).
- The full module contract is in `docs/ARCHITECTURE.md`; project notes for AI assistants in `CLAUDE.md`.
- `npm run typecheck` type-checks the factory; `npm run build` compiles it to `dist/`.

**Security notes.** Clooney-Agent is third-party code downloaded into `vendor/` and pinned to a specific
commit; it only runs when a Gemini key is configured. site-facelift's AI review runs
`claude -p --dangerously-skip-permissions` inside each generated project folder; turn it off with
`"aiReview": "off"` in `config/factory.config.json` (or `FACELIFT_AI_REVIEW=off` in `.env`).
