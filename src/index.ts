import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { NO_URLS_HELP, USAGE, isPlaceholderUrl, normalizeUrls, parseArgs, parseUrls, renderUrlsFile } from "./cli.js";
import { Orchestrator } from "./orchestrator.js";
import { clearSentinels } from "./utils/checkpoint.js";
import { DEFAULT_FLAGS, loadFactoryContext, repoRoot, type FactoryContext } from "./utils/config.js";
import { initLLM } from "./utils/llm.js";
import { isoTimestamp, logger } from "./utils/logger.js";

/**
 * artist-site-factory entrypoint — `npm start` / `npm run generate-websites -- --urls <url...>`.
 * Resolves the inspiration URLs (command line or config/urls.txt), runs the nine-phase pipeline and
 * prints how to run each generated site.
 */

async function reset(root: string): Promise<void> {
  const ctx = await loadFactoryContext({ ...DEFAULT_FLAGS, reset: true }, root, { requirePrompts: false });
  await clearSentinels(root, 1);
  await fs.remove(ctx.paths.stateFile);
  await fs.remove(ctx.paths.logFile);
  const keepArtifacts = new Set(["design-tokens", "feature-manifests", "marisela-content", "validation-reports"]);
  for (const entry of (await fs.pathExists(ctx.paths.artifactsDir)) ? await fs.readdir(ctx.paths.artifactsDir) : []) {
    const full = path.join(ctx.paths.artifactsDir, entry);
    if (keepArtifacts.has(entry)) {
      for (const inner of await fs.readdir(full)) if (inner !== ".gitkeep") await fs.remove(path.join(full, inner));
    } else if (entry !== ".gitkeep") {
      await fs.remove(full);
    }
  }
  for (const entry of (await fs.pathExists(ctx.paths.outputDir)) ? await fs.readdir(ctx.paths.outputDir) : []) {
    if (entry !== ".gitkeep") await fs.remove(path.join(ctx.paths.outputDir, entry));
  }
  process.stdout.write(`${chalk.green("✔")} Reset complete: generated sites, artifacts, factory.log and progress markers removed.\n`);
}

const fail = (message: string): number => {
  process.stderr.write(`${chalk.red("✖")} ${message}\n`);
  return 1;
};

/**
 * The inspiration URLs for this run. URLs given on the command line replace config/urls.txt (the
 * previous list is kept in config/urls.previous.txt) so a later plain `npm start` resumes the same run.
 * Returns null — after explaining why — when there is nothing usable to work from.
 */
async function resolveUrls(ctx: FactoryContext, inputs: string[], root: string): Promise<{ urls: string[]; notes: string[] } | null> {
  const notes: string[] = [];
  const rel = path.relative(root, ctx.paths.urlsFile);
  let urls: string[];
  if (inputs.length && !(inputs.length === 1 && ctx.flags.urlsFile)) {
    const parsed = normalizeUrls(inputs);
    if (parsed.invalid.length) {
      fail(`Not a website address: ${parsed.invalid.map((v) => `"${v}"`).join(", ")}. Use full addresses such as https://www.artist-name.com`);
      return null;
    }
    urls = parsed.urls;
    const previous = (await fs.pathExists(ctx.paths.urlsFile)) ? await fs.readFile(ctx.paths.urlsFile, "utf8") : "";
    const previousUrls = parseUrls(previous).urls;
    if (previousUrls.join("\n") !== urls.join("\n")) {
      if (previousUrls.some((u) => !isPlaceholderUrl(u))) {
        await fs.writeFile(path.join(path.dirname(ctx.paths.urlsFile), "urls.previous.txt"), previous, "utf8");
        notes.push(`The previous list was kept in ${path.join(path.dirname(rel), "urls.previous.txt")}.`);
      }
      await fs.outputFile(ctx.paths.urlsFile, renderUrlsFile(urls, isoTimestamp().slice(0, 10)), "utf8");
      notes.unshift(`Saved ${urls.length} inspiration URL(s) to ${rel}.`);
    }
  } else {
    if (!(await fs.pathExists(ctx.paths.urlsFile))) {
      fail(`URL list not found: ${rel}.${NO_URLS_HELP}`);
      return null;
    }
    const parsed = parseUrls(await fs.readFile(ctx.paths.urlsFile, "utf8"));
    for (const line of parsed.invalid) notes.push(`Ignoring a line in ${rel} that is not a website address: "${line}"`);
    urls = parsed.urls;
  }
  const placeholders = urls.filter(isPlaceholderUrl);
  urls = urls.filter((u) => !isPlaceholderUrl(u));
  if (!urls.length) {
    fail(
      placeholders.length
        ? `No inspiration websites yet — ${rel} only lists the example addresses (${placeholders.map((u) => new URL(u).hostname).join(", ")}).${NO_URLS_HELP}`
        : `No inspiration websites found in ${rel}.${NO_URLS_HELP}`,
    );
    return null;
  }
  if (placeholders.length) notes.push(`Skipping the example address(es) ${placeholders.join(", ")}.`);
  return { urls, notes };
}

async function main(): Promise<number> {
  let flags: ReturnType<typeof parseArgs>;
  try {
    flags = parseArgs(process.argv.slice(2));
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
  if (flags.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  const root = repoRoot();
  if (flags.reset) {
    await reset(root);
    return 0;
  }

  // A single --urls value naming an existing file is a URL list file (the original --urls <file> form).
  const single = flags.urlInputs.length === 1 ? path.resolve(root, flags.urlInputs[0]) : null;
  if (single && (await fs.pathExists(single)) && (await fs.stat(single)).isFile()) flags.urlsFile = single;

  const ctx = await loadFactoryContext(flags, root);
  // Resolved before the log file is opened, so a run that cannot start leaves nothing behind.
  const resolved = await resolveUrls(ctx, flags.urlInputs, root);
  if (!resolved) return 1;
  const { urls, notes } = resolved;

  logger.attachFile(ctx.paths.logFile);
  logger.setVerbose(flags.verbose);
  logger.info(`artist-site-factory starting (node ${process.version}, ${process.platform})`);
  logger.info(`AI mode: ${flags.noAi ? "off (--no-ai)" : ctx.config.llm.provider}; page composition uses ${ctx.config.tools.jsonRender.model} at ${ctx.config.tools.jsonRender.effort} effort, one call per site, max ${ctx.config.tools.jsonRender.maxRepairAttempts} repair retries; site-facelift AI review ${ctx.config.tools.facelift.aiReview}`);
  for (const note of notes) logger.info(note);
  await initLLM({ mode: flags.noAi ? "off" : ctx.config.llm.provider, cliTimeoutMs: ctx.config.llm.cliTimeoutMs, logger });
  logger.info(`Inspiration URLs (${urls.length}): ${urls.join(", ")}`);

  const summary = await new Orchestrator(ctx, logger).run(urls);
  const built = summary.projects.filter((p) => p.built);
  process.stdout.write(`\n${chalk.bold.green(`✔ ${summary.projects.length} website${summary.projects.length === 1 ? "" : "s"} generated`)}${built.length < summary.projects.length ? chalk.yellow(` (${built.length} built successfully)`) : ""} in ${path.relative(root, ctx.paths.outputDir)}/\n\n`);
  for (const p of summary.projects) {
    const status = p.built ? (p.smokeTest === "failed" ? chalk.yellow("built, smoke test failed") : chalk.green("ready")) : chalk.red("build failed");
    process.stdout.write(`  ${chalk.bold(p.name)}  ${status}\n    ${chalk.cyan(p.runCommand)}\n`);
  }
  process.stdout.write(`\n  Report: ${chalk.cyan(summary.reportFile)}   Log: ${chalk.cyan(path.relative(root, ctx.paths.logFile))}\n  Then open http://localhost:3000\n\n`);
  return 0;
}

main()
  .then(async (code) => {
    await logger.close();
    process.exit(code);
  })
  .catch(async (err: unknown) => {
    logger.error("artist-site-factory failed", err);
    process.stderr.write(`\n${chalk.red("✖")} ${err instanceof Error ? err.message : String(err)}\n  See factory.log for details. Re-run \`npm start\` to resume from the failed phase.\n`);
    await logger.close();
    process.exit(1);
  });
