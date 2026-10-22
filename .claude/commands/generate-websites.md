---
description: Generate the six Marisela websites from inspiration URLs (runs the artist-site-factory pipeline)
argument-hint: --urls <url1> <url2> ... [--no-ai] [--variations <n>] [--fresh] [--from <n>]
disable-model-invocation: true
allowed-tools: Bash(npm run generate-websites:*), Bash(npm install), Bash(node --version), Bash(tail:*), Read
---

Generate the websites with this repository's pipeline. Arguments from the user: `$ARGUMENTS`

The pipeline (`npm run generate-websites`) does all of the work — scraping, design extraction,
content research, page composition, validation, `npm install`, builds and smoke tests. Your job is
to start it, stay out of its way, and report the result. Keep this session light: do not read
generated source code, `node_modules/`, raw artifacts or the full `factory.log`.

## 1. Check the input

- If the arguments contain no URL and no `--urls`, read `config/urls.txt`. If it only lists the
  example addresses (`example-artist-1.com`, `example-artist-2.com`) or nothing, ask the user for
  the inspiration websites and stop. Otherwise the run uses (or resumes with) the saved list.
- URLs may be written without `https://`; the pipeline normalizes them and rejects anything that is
  not a website address.

## 2. Preflight (quick)

- `node --version` must be v20 or newer.
- If `node_modules/` does not exist, run `npm install` first (one time, a few minutes; it also
  downloads Chromium).

## 3. Start the run in the background

Run, with the Bash tool's `run_in_background: true` (a run takes roughly 15–40 minutes, longer than
the foreground limit):

```bash
npm run generate-websites -- <the user's arguments, each URL in double quotes>
```

Then tell the user, in a few lines, that the run has started, that it takes roughly 15–40 minutes,
and that progress is written to `factory.log`. Unless `--no-ai` was given, the pipeline may call
Claude Code for page composition (defaults: one sequential Sonnet call per site, low effort, no
repair retries; site-facelift AI review is off). These calls count toward their Claude usage.
`--no-ai` produces the sites without model calls. End your turn; do not poll or sleep. You will be
notified when the command exits.

If the user asks for progress meanwhile, show the last ~15 lines of `factory.log` (`tail -n 15 factory.log`).

## 4. When it finishes

- **Exit code 0:** read `artifacts/report.md` (a few KB) and give the user a short summary:
  - each site, whether it is ready, and its run command (`cd generated-websites/<site> && npm run dev`, then http://localhost:3000)
  - how many features the sites share (the feature union) and which inspiration sites were used
  - the fact checks that were contradicted or unverified, and any warnings, in one or two lines

  Point to `artifacts/report.md` for the full report. Offer to start one of the sites.
- **Non-zero exit:** read the last ~60 lines of `factory.log` and any `STEP*_FAILED` file in the
  repository root, explain the cause in plain words, and fix it if it is an environment problem
  (missing dependency, network, disk space). Then run `npm run generate-websites` again *without*
  arguments, in the background: it resumes from the failed step using the URLs saved in
  `config/urls.txt`. Never add `--fresh` unless the user asks — it throws away finished work.
- If Claude hit a usage/session limit during the run, the pipeline switches to its built-in page
  composer and finishes anyway; say so. Do not automatically rerun Phase 6, because that makes new
  Claude calls; explain that the user can choose to do so later with
  `npm run generate-websites -- --from 6`.
