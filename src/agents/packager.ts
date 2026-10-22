import path from "node:path";
import fs from "fs-extra";
import pLimit from "p-limit";
import type { GeneratedProject, PackagingResult, PipelineRun } from "../types/pipeline.js";
import type { FactoryContext } from "../utils/config.js";
import { readJsonIfExists, toPosixRelative, writeJson } from "../utils/file-utils.js";
import type { Logger } from "../utils/logger.js";
import { isoTimestamp } from "../utils/logger.js";
import { run as exec, spawnBackground, type RunResult } from "../utils/shell.js";
import { parseContentModule } from "./validator.js";

/**
 * Phase 8 — the AgentMesh "Reviewer". Makes every project immediately runnable:
 * npm install → next build (with a small auto-fix loop) → `npm run dev` smoke test → RUN.md.
 * node_modules is kept in place so `npm run dev` works from a fresh terminal.
 */

const PHASE = "PHASE_8_PACKAGING" as const;

function packagingFile(project: GeneratedProject): string {
  return path.join(project.dir, ".factory", "packaging.json");
}

export async function loadPackagingResults(ctx: FactoryContext, projects: GeneratedProject[]): Promise<PackagingResult[]> {
  const out: PackagingResult[] = [];
  for (const p of projects) {
    const r = await readJsonIfExists<PackagingResult | null>(packagingFile(p), null);
    if (r) out.push(r);
  }
  void ctx;
  return out;
}

function runCommandFor(ctx: FactoryContext, project: GeneratedProject): string {
  return `cd ${toPosixRelative(ctx.paths.root, project.dir)} && npm run dev`;
}

async function appendLog(file: string, title: string, res: RunResult): Promise<void> {
  await fs.ensureDir(path.dirname(file));
  await fs.appendFile(file, `\n===== ${title} — ${isoTimestamp()} — exit ${res.exitCode ?? "n/a"}${res.timedOut ? " (timeout)" : ""} =====\n$ ${res.command}\n${res.all}\n`, "utf8");
}

interface Fix {
  description: string;
  apply: () => Promise<boolean>;
}

/** Pick the first applicable automatic fix for a failed build log. */
function chooseFix(output: string, project: GeneratedProject, log: Logger, applied: Set<string>, installTimeoutMs: number): Fix | null {
  const missing = output.match(/Module not found: (?:Error: )?Can't resolve '([^']+)'/)?.[1];
  if (missing && !missing.startsWith(".") && !missing.startsWith("@/")) {
    const pkg = missing.startsWith("@") ? missing.split("/").slice(0, 2).join("/") : missing.split("/")[0];
    const key = `install:${pkg}`;
    if (!applied.has(key)) {
      return {
        description: `installed missing package "${pkg}"`,
        apply: async () => {
          applied.add(key);
          const res = await exec("npm", ["install", pkg, "--no-audit", "--no-fund"], { cwd: project.dir, timeoutMs: installTimeoutMs, label: `npm:${project.projectName}`, logger: log });
          return !res.failed;
        },
      };
    }
  }
  if (/next\/font|fonts\.googleapis|fonts\.gstatic|Failed to fetch font|Error while requesting resource/i.test(output) && !applied.has("fonts")) {
    return {
      description: "switched to system font fallbacks (Google Fonts could not be downloaded)",
      apply: async () => {
        applied.add("fonts");
        const layoutPath = path.join(project.dir, "app", "layout.tsx");
        let layout = await fs.readFile(layoutPath, "utf8");
        layout = layout
          .replace(/import \{[^}]*\} from "next\/font\/google";\n/, "")
          .replace(/const \w+Font = \w+\(\{[\s\S]*?\}\);\n\n?/g, "")
          .replace(/className=\{`[^`]*`\}/, "");
        await fs.writeFile(layoutPath, layout, "utf8");
        const cssPath = path.join(project.dir, "app", "globals.css");
        const css = await fs.readFile(cssPath, "utf8");
        const fallback = `\n:root {\n  --font-display: Georgia, "Times New Roman", serif;\n  --font-body: "Segoe UI", Helvetica, Arial, sans-serif;\n  --font-mono: ui-monospace, Consolas, monospace;\n}\n`;
        await fs.writeFile(cssPath, css.replace(/(@config[^\n]*\n)/, `$1${fallback}`), "utf8");
        return true;
      },
    };
  }
  if (/Type error|Failed to type check|TS\d{4}/i.test(output) && !applied.has("ts")) {
    return {
      description: "allowed the build to proceed despite type errors (typescript.ignoreBuildErrors) — see the build log",
      apply: async () => {
        applied.add("ts");
        const cfgPath = path.join(project.dir, "next.config.js");
        const cfg = await fs.readFile(cfgPath, "utf8");
        if (!cfg.includes("ignoreBuildErrors")) await fs.writeFile(cfgPath, cfg.replace("eslint: { ignoreDuringBuilds: true },", "eslint: { ignoreDuringBuilds: true },\n  typescript: { ignoreBuildErrors: true },"), "utf8");
        return true;
      },
    };
  }
  return null;
}

async function smokeTest(project: GeneratedProject, port: number, timeoutMs: number, log: Logger): Promise<{ ok: boolean; detail: string }> {
  let artistName = "";
  try {
    artistName = parseContentModule(await fs.readFile(path.join(project.dir, "lib", "content.ts"), "utf8")).name;
  } catch {
    // name check skipped
  }
  const server = spawnBackground("npm", ["run", "dev", "--", "--port", String(port)], { cwd: project.dir, label: `dev:${project.projectName}`, logger: log, env: { NEXT_TELEMETRY_DISABLED: "1", BROWSER: "none" } });
  try {
    const ready = await server.waitFor(/Ready in|Local:\s+http/i, Math.min(timeoutMs, 90_000));
    if (!ready) return { ok: false, detail: `dev server did not start: ${server.output().split("\n").slice(-4).join(" | ")}` };
    const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(timeoutMs) });
    const html = await res.text();
    if (res.status !== 200) return { ok: false, detail: `GET / returned HTTP ${res.status}` };
    if (artistName && !html.includes(artistName)) return { ok: false, detail: "page rendered without the artist name" };
    return { ok: true, detail: `GET / → 200 (${Math.round(html.length / 1024)} KB)` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  } finally {
    await server.stop();
  }
}

function runMd(ctx: FactoryContext, project: GeneratedProject, result: PackagingResult): string {
  const rel = toPosixRelative(ctx.paths.root, project.dir);
  return `# How to run ${project.projectName}

${project.briefName} design · generated by artist-site-factory.

## Start the site

\`\`\`bash
cd ${rel}
npm run dev
\`\`\`

Then open **http://localhost:3000**. Dependencies (\`node_modules/\`) are already installed.
To run several sites at once, give each its own port: \`npm run dev -- --port 3001\`.

## Production

\`\`\`bash
npm run build
npm start
\`\`\`

## Status at generation time

- Dependencies installed: ${result.installed ? "yes" : "NO — run `npm install` first"}
- Production build: ${result.built ? "passed" : "FAILED — see artifacts/build-logs/" + project.projectName + ".log in the factory"}
- Dev-server smoke test: ${result.smokeTest}
${result.fixesApplied.length ? `- Automatic fixes applied: ${result.fixesApplied.join("; ")}\n` : ""}
## Notes

- Content lives in \`lib/content.ts\` (fetched from public sources; see README.md for provenance and licenses).
- The newsletter form is a front-end mock — connect \`components/Newsletter.tsx\` to your email provider before launch.
- To regenerate this site, run \`npm start -- --from 6\` in the factory folder.
`;
}

async function packageOne(run: PipelineRun, project: GeneratedProject, index: number): Promise<PackagingResult> {
  const { ctx } = run;
  const cfg = ctx.config.packaging;
  const log = run.logger.child("package");
  const started = Date.now();
  const logFile = path.join(ctx.paths.buildLogsDir, `${project.projectName}.log`);
  await fs.remove(logFile);
  const result: PackagingResult = {
    project: project.projectName,
    dir: project.dir,
    installed: false,
    built: false,
    buildAttempts: 0,
    fixesApplied: [],
    smokeTest: "skipped",
    runFile: toPosixRelative(ctx.paths.root, path.join(project.dir, "RUN.md")),
    runCommand: runCommandFor(ctx, project),
    buildLog: toPosixRelative(ctx.paths.root, logFile),
    durationMs: 0,
  };

  if (cfg.install) {
    log.info(`Phase 8: npm install in ${project.projectName}`);
    let install = await exec("npm", cfg.installArgs, { cwd: project.dir, timeoutMs: cfg.installTimeoutMs, label: `npm:${project.projectName}`, logger: log });
    await appendLog(logFile, "npm install", install);
    if (install.failed) {
      log.warn(`npm install failed for ${project.projectName}; retrying without --prefer-offline`);
      install = await exec("npm", cfg.installArgs.filter((a) => a !== "--prefer-offline"), { cwd: project.dir, timeoutMs: cfg.installTimeoutMs, label: `npm:${project.projectName}`, logger: log });
      await appendLog(logFile, "npm install (retry)", install);
    }
    result.installed = !install.failed && (await fs.pathExists(path.join(project.dir, "node_modules", "next")));
    if (!result.installed) result.error = `npm install failed (exit ${install.exitCode})`;
  } else {
    result.installed = await fs.pathExists(path.join(project.dir, "node_modules", "next"));
  }

  if (result.installed && cfg.build) {
    const applied = new Set<string>();
    for (let attempt = 1; attempt <= cfg.maxFixAttempts + 1; attempt++) {
      result.buildAttempts = attempt;
      log.info(`Phase 8: next build in ${project.projectName}${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
      const build = await exec("npm", ["run", "build"], { cwd: project.dir, timeoutMs: cfg.buildTimeoutMs, label: `build:${project.projectName}`, logger: log, env: { NEXT_TELEMETRY_DISABLED: "1" } });
      await appendLog(logFile, `npm run build (attempt ${attempt})`, build);
      if (!build.failed) {
        result.built = true;
        result.error = undefined;
        break;
      }
      result.error = `build failed: ${build.all.split("\n").filter((l) => /error|failed/i.test(l)).slice(0, 3).join(" | ").slice(0, 400)}`;
      const fix = chooseFix(build.all, project, log, applied, cfg.installTimeoutMs);
      if (!fix || attempt > cfg.maxFixAttempts) break;
      log.warn(`${project.projectName}: build failed — auto-fix: ${fix.description}`);
      if (await fix.apply()) result.fixesApplied.push(fix.description);
    }
  }

  if (result.built && cfg.smokeTest) {
    const port = cfg.smokeTestBasePort + index;
    log.info(`Phase 8: smoke test (npm run dev on port ${port}) for ${project.projectName}`);
    const smoke = await smokeTest(project, port, cfg.smokeTestTimeoutMs, log);
    result.smokeTest = smoke.ok ? "passed" : "failed";
    await fs.appendFile(logFile, `\n===== smoke test: ${smoke.ok ? "passed" : "failed"} — ${smoke.detail} =====\n`, "utf8");
    if (!smoke.ok) log.warn(`${project.projectName}: smoke test failed — ${smoke.detail}`);
  }

  // Final integrity check: what the user needs to run `npm run dev`.
  const binNext = path.join(project.dir, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
  if (result.installed && !(await fs.pathExists(binNext))) {
    result.installed = false;
    result.error = (result.error ? `${result.error}; ` : "") + "node_modules/.bin/next missing";
  }
  result.durationMs = Date.now() - started;
  await fs.writeFile(path.join(project.dir, "RUN.md"), runMd(ctx, project, result), "utf8");
  await writeJson(packagingFile(project), result);
  return result;
}

export async function packageProjects(run: PipelineRun, projects: GeneratedProject[]): Promise<PackagingResult[]> {
  const { ctx, checkpoint } = run;
  const log = run.logger.child("package");
  const limit = pLimit(ctx.config.concurrency.builds);
  const results = await Promise.all(
    projects.map((project, index) =>
      limit(async (): Promise<PackagingResult | null> => {
        const existing = await readJsonIfExists<PackagingResult | null>(packagingFile(project), null);
        if (checkpoint.isItemDone(PHASE, project.projectName) && existing?.built && (await fs.pathExists(path.join(project.dir, "node_modules", "next")))) {
          log.info(`${project.projectName} already packaged — skipping`);
          return existing;
        }
        await checkpoint.setItem(PHASE, project.projectName, "running");
        try {
          const r = await packageOne(run, project, index);
          if (r.built && r.smokeTest !== "failed") log.success(`${project.projectName}: ready → ${r.runCommand}`);
          else log.warn(`${project.projectName}: ${r.error ?? "smoke test failed"}`);
          await checkpoint.setItem(PHASE, project.projectName, r.built ? (r.smokeTest === "failed" || r.fixesApplied.length ? "degraded" : "completed") : "failed", r.error);
          return r;
        } catch (err) {
          log.error(`Packaging ${project.projectName} crashed`, err);
          await checkpoint.setItem(PHASE, project.projectName, "failed", err instanceof Error ? err.message : String(err));
          return null;
        }
      }),
    ),
  );
  return results.filter((r): r is PackagingResult => r !== null);
}
