# Developer Setup Guide

This guide takes you from a fresh clone to generating the six Marisela website
variations. It describes the repository's current defaults and separates
required setup from optional AI and data-source integrations.

## 1. Install prerequisites

### Required

- **Git** — clone the repository and fetch the pinned Clooney-Agent dependency.
- **Node.js 20 or newer**, which includes npm — run the factory and the generated
  Next.js applications.
- **Internet access** — download npm dependencies and Chromium, fetch inspiration
  pages and public artist information, and install runtime tools.

Check that the tools are available:

```powershell
git --version
node --version
npm --version
```

Use a current Node.js LTS release. The factory's `npm install` also runs the
Playwright post-install step to install Chromium. No global TypeScript, `tsx`,
chhapify, or json-render installation is needed; the factory installs these
JavaScript dependencies locally.

### Optional

- **Claude Code CLI**, installed and logged in, or an **Anthropic API key**:
  enables AI-assisted page composition. Without either, the deterministic
  composer still generates the sites.
- **Python 3.10+**: lets the factory install and use site-facelift in its own
  virtual environment. Built-in crawling and mechanical validation paths remain
  available if Python or site-facelift is unavailable.
- **Gemini API key**: enables Clooney-Agent's Gemini vision analysis of
  inspiration sites. The built-in DOM analyzer still runs without it.
- **Ticketmaster API key** or **Bandsintown app ID**: enables those concert-date
  sources. Without them, no dates from those providers are available, and the
  tour section can display a "dates coming soon" message.
- **OpenAI API key**: not needed by the currently configured Gemini-backed
  Clooney integration. It is only passed through for an alternate Clooney
  implementation that uses OpenAI.

No API key is required to run the pipeline. API keys are separate credentials:
a Gemini key cannot authenticate to OpenAI or Anthropic.

## 2. Clone and install the repository

In PowerShell, run:

```powershell
git clone <repository-url>
Set-Location <repository-folder>
npm install
```

`npm install` installs the root dependencies and downloads Playwright Chromium.
The factory installs the pinned Clooney-Agent checkout into `vendor/` when it is
needed, and installs site-facelift into `vendor/facelift-venv` if Python is
available. Those vendor directories are runtime-generated and ignored by Git;
they are provisioned again on a new machine.

Optional quick check:

```powershell
npm run typecheck
```

## 3. Configure inspiration URLs

Edit `config/urls.txt` and put one real inspiration website URL on each line.
Lines beginning with `#` and blank lines are ignored. Replace the example or
existing URLs with the sites you want this run to learn from. The sites must be
reachable from your computer.

Alternatively, supply URLs on the generation command; the factory saves those
URLs to `config/urls.txt` for later runs:

```powershell
npm run generate-websites -- --urls https://artist-one.example https://artist-two.example
```

Use actual artist website addresses in place of the example domains above.

## 4. Configure optional API keys

Copy the sample environment file if you want to use any credentials:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace only the values for providers you intend to use. Leave
unused entries empty or commented out. The file is ignored by Git; **never commit
it or share its contents**.

| Variable | Needed for | Current behavior without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API page composition | If a logged-in `claude` CLI is available, `llm.provider: auto` uses that instead; otherwise page composition uses the deterministic fallback. |
| `GEMINI_API_KEY` | Clooney-Agent visual analysis | The DOM-based feature analyzer still runs. |
| `TICKETMASTER_API_KEY` | Ticketmaster concert-date lookup | Ticketmaster is skipped. |
| `BANDSINTOWN_APP_ID` | Bandsintown concert-date lookup | Bandsintown is skipped. |
| `OPENAI_API_KEY` | An alternate Clooney implementation that calls OpenAI | Not used by the currently configured Gemini-backed Clooney-Agent. |

Accepted alternative variable names are `ANTHROPIC_AUTH_TOKEN` for
`ANTHROPIC_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY` for `GEMINI_API_KEY`.
`ANTHROPIC_MODEL` optionally overrides the Claude model configured for page
composition. `CLOONEY_REPO_URLS` can optionally override the comma-separated
Clooney repository list.

### Current AI usage defaults

In `config/factory.config.json`, the current defaults:

- Use `llm.provider: "auto"`: prefer the Anthropic API when a key is configured,
  otherwise use the Claude Code CLI if installed and logged in.
- Compose pages sequentially with Sonnet at low effort, with one attempt per
  site and no repair retry.
- Turn off AI biography polishing, site-facelift AI review, and site-facelift
  cleanup. Mechanical validation still runs.
- Fall back to deterministic composition if no provider is available or Claude
  becomes unavailable.

The factory cannot guarantee that a provider will not impose a usage limit. The
`--no-ai` option disables Claude calls; it does not disable Clooney-Agent's
Gemini visual analysis if `GEMINI_API_KEY` is configured.

To enable the optional site-facelift AI review or cleanup, change
`tools.facelift.aiReview` or `tools.facelift.aiCleanup` in
`config/factory.config.json` (or set `FACELIFT_AI_REVIEW` /
`FACELIFT_AI_CLEANUP` in `.env`). Review requires Python/site-facelift and the
Claude Code CLI. Cleanup can modify generated project files; review these
changes before publishing.

## 5. Generate the websites

From the repository root, run either:

```powershell
npm start
```

This uses `config/urls.txt`. Or provide and save URLs directly:

```powershell
npm run generate-websites -- --urls https://artist-one.example https://artist-two.example
```

The pipeline runs nine phases: acquire inspiration sites, extract design
systems, inventory features, compute their union, fetch artist content, generate
the sites, validate them, install/build/smoke-test each project, and write the
report. A full run can take 15–40 minutes or longer, depending on network,
external tools, and optional AI calls. Follow progress in the console or
`factory.log`.

Do not pass `--no-ai` if you want Claude-assisted composition. To skip Claude
calls while allowing any configured Gemini analysis, use:

```powershell
npm start -- --no-ai
```

## 6. Check and run generated projects

After generation, inspect `artifacts/report.md` for the inspiration URLs, sources,
fact checks, validation results, and per-site build and smoke-test status.
Generated projects are written to `generated-websites/`. Start a site using the
command printed by the factory, for example:

```powershell
Set-Location generated-websites\marisela-site-01-minimalist
npm run dev
```

Open <http://localhost:3000>. Stop the server with `Ctrl+C`. Each generated site
has its own `package.json` and is ready to run after a successful pipeline
package phase.

Generated site source is eligible for Git tracking, but `node_modules/` is
ignored at every depth. Do not expect installed dependencies to be present in a
fresh clone of a generated site; run `npm install` in that site folder if you
need to use it independently from a completed factory run.

## 7. Resume or regenerate

- **Resume after an interruption:** run `npm start` again. Completed phases and
  completed site items are checkpointed and skipped.
- **Regenerate sites while reusing earlier research:** run
  `npm start -- --from 6`. This reruns generation and subsequent validation,
  packaging, and reporting phases. It can overwrite generated projects and
  consume AI usage if a provider is enabled.
- **Generate fewer variations:** run `npm start -- --variations 1` (or another
  positive count up to the configured number of design briefs).
- **Show more diagnostic output:** add `--verbose`.
- **Reset generated output and pipeline state:** `npm run reset`. This deletes
  generated sites and artifacts; only use it when you intend to discard them.

See `npm start -- --help` for the full command options.

## 8. Important files

- `config/urls.txt` — inspiration URLs.
- `config/factory.config.json` — provider, design count, tool switches, resource
  limits, and packaging settings.
- `config/artist.json` — artist lookup and claims to verify.
- `config/design-briefs.json` and `prompts/` — the visual variations.
- `config/feature-map.json` — recognized features and their mappings.
- `.env.example` — optional environment-variable template; copy to ignored
  `.env` for local credentials.
- `generated-websites/` — generated application source.
- `artifacts/report.md` and `factory.log` — run summary and diagnostics.
- `src/` and `templates/` — factory implementation and site templates.

The README has further usage notes and troubleshooting guidance.
