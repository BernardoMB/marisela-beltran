import path from "node:path";
import fs from "fs-extra";
import pLimit from "p-limit";
import { chromium, type Browser, type BrowserContext, type Page, type Response } from "playwright";
import { captureDomSnapshot } from "../tools/dom-snapshot.js";
import type { AcquisitionResult, InspirationSite, PipelineRun } from "../types/pipeline.js";
import type { FactoryContext } from "../utils/config.js";
import { readJsonIfExists, slugify, toPosixRelative, writeJson } from "../utils/file-utils.js";
import type { Logger } from "../utils/logger.js";

/**
 * Phase 1 — acquire each inspirational site: rendered DOM, raw HTML, CSS/JS assets, screenshots and a
 * structural DOM snapshot (Playwright), plus a bounded crawl with site-facelift's crawler when available.
 * A failing URL never fails the phase: it is recorded with ok:false and later phases fall back.
 */

const PHASE = "PHASE_1_ACQUISITION" as const;
const MAX_SCREENSHOT_HEIGHT = 10_000;

const COOKIE_SELECTORS = [
  "#onetrust-accept-btn-handler",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  "#CybotCookiebotDialogBodyButtonAccept",
  "button#accept-recommended-btn-handler",
  ".cc-allow",
  "[aria-label='Accept cookies']",
  "button:has-text('Accept all')",
  "button:has-text('Accept All')",
  "button:has-text('Accept')",
  "button:has-text('Aceptar todo')",
  "button:has-text('Aceptar')",
  "button:has-text('I agree')",
  "button:has-text('Agree')",
  "button:has-text('Got it')",
];

const BOT_WALL = /just a moment|attention required|access denied|are you a robot|verify you are human|captcha|request blocked|forbidden/i;

function acquisitionFile(ctx: FactoryContext, slug: string): string {
  return path.join(ctx.paths.acquisitionDir, slug, "acquisition.json");
}

export async function loadAcquisition(ctx: FactoryContext, slug: string): Promise<AcquisitionResult | null> {
  return readJsonIfExists<AcquisitionResult | null>(acquisitionFile(ctx, slug), null);
}

export async function acquireSites(run: PipelineRun): Promise<AcquisitionResult[]> {
  const { ctx, checkpoint } = run;
  const log = run.logger.child("acquire");
  const limit = pLimit(ctx.config.concurrency.urls);
  let browserPromise: Promise<Browser> | null = null;
  const getBrowser = () => (browserPromise ??= chromium.launch({ headless: true }));

  try {
    return await Promise.all(
      run.sites.map((site) =>
        limit(async (): Promise<AcquisitionResult> => {
          if (checkpoint.isItemDone(PHASE, site.slug)) {
            const previous = await loadAcquisition(ctx, site.slug);
            if (previous) {
              log.info(`${site.url} already acquired — skipping`);
              return previous;
            }
          }
          await checkpoint.setItem(PHASE, site.slug, "running");
          log.info(`Phase 1: Acquiring ${site.url}`);
          let result: AcquisitionResult;
          try {
            result = await acquireOne(ctx, site, await getBrowser(), log);
          } catch (err) {
            result = failedResult(ctx, site, err instanceof Error ? err.message : String(err), 0);
          }
          await writeJson(acquisitionFile(ctx, site.slug), result);
          if (result.ok) {
            log.success(`Acquired ${site.url} (${result.assetCount} assets, ${result.methods.join(" + ")})`);
            await checkpoint.setItem(PHASE, site.slug, "completed");
          } else {
            log.warn(`Could not fully acquire ${site.url}: ${result.error ?? "unknown error"} — later phases will fall back`);
            await checkpoint.setItem(PHASE, site.slug, "degraded", result.error);
          }
          return result;
        }),
      ),
    );
  } finally {
    // (cast: TS cannot see the assignment inside the getBrowser closure)
    const pending = browserPromise as Promise<Browser> | null;
    if (pending) await (await pending).close().catch(() => undefined);
  }
}

function failedResult(ctx: FactoryContext, site: InspirationSite, error: string, durationMs: number): AcquisitionResult {
  return {
    url: site.url,
    slug: site.slug,
    ok: false,
    dir: path.join(ctx.paths.acquisitionDir, site.slug),
    files: {},
    assetCount: 0,
    methods: [],
    warnings: [],
    error,
    durationMs,
  };
}

async function acquireOne(ctx: FactoryContext, site: InspirationSite, browser: Browser, log: Logger): Promise<AcquisitionResult> {
  const started = Date.now();
  const cfg = ctx.config.acquisition;
  const dir = path.join(ctx.paths.acquisitionDir, site.slug);
  await fs.emptyDir(dir);
  const rel = (p: string) => toPosixRelative(ctx.paths.root, p);
  const result: AcquisitionResult = {
    url: site.url,
    slug: site.slug,
    ok: false,
    dir,
    files: {},
    assetCount: 0,
    methods: [],
    warnings: [],
    durationMs: 0,
  };

  let context: BrowserContext | null = null;
  try {
    context = await browser.newContext({
      userAgent: cfg.userAgent,
      locale: "es-MX",
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(cfg.navigationTimeoutMs);
    const assetResponses: Response[] = [];
    page.on("response", (resp) => {
      const type = resp.request().resourceType();
      if ((type === "stylesheet" || type === "script") && assetResponses.length < cfg.maxAssets * 2) assetResponses.push(resp);
    });

    const main = await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: cfg.navigationTimeoutMs });
    if (!main) throw new Error("navigation returned no response");
    result.httpStatus = main.status();
    result.finalUrl = page.url();
    try {
      const raw = await main.text();
      await fs.writeFile(path.join(dir, "raw.html"), raw, "utf8");
      result.files.rawHtml = rel(path.join(dir, "raw.html"));
    } catch {
      result.warnings.push("raw HTML body unavailable (redirected document)");
    }

    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(cfg.settleMs);
    await dismissCookieBanner(page);
    await autoScroll(page);
    result.title = await page.title().catch(() => "");

    const rendered = await page.content();
    await fs.writeFile(path.join(dir, "rendered.html"), rendered, "utf8");
    result.files.renderedHtml = rel(path.join(dir, "rendered.html"));

    const snapshot = await captureDomSnapshot(page);
    await writeJson(path.join(dir, "dom-snapshot.json"), snapshot);
    result.files.domSnapshot = rel(path.join(dir, "dom-snapshot.json"));

    const height = await page.evaluate("document.documentElement.scrollHeight").then(Number).catch(() => 0);
    const desktopShot = path.join(dir, "screenshot-desktop.png");
    await page
      .screenshot({
        path: desktopShot,
        fullPage: true,
        clip: height > MAX_SCREENSHOT_HEIGHT ? { x: 0, y: 0, width: 1440, height: MAX_SCREENSHOT_HEIGHT } : undefined,
      })
      .then(() => {
        result.files.screenshotDesktop = rel(desktopShot);
      })
      .catch((err: unknown) => result.warnings.push(`desktop screenshot failed: ${String(err).slice(0, 120)}`));

    result.assetCount = await saveAssets(assetResponses, path.join(dir, "assets"), cfg.maxAssets, cfg.maxAssetBytes);
    if (result.assetCount > 0) result.files.assetsDir = rel(path.join(dir, "assets"));
    result.methods.push("playwright");

    const blocked = (result.httpStatus ?? 200) >= 400 || BOT_WALL.test(result.title ?? "");
    if (blocked) {
      result.error = `HTTP ${result.httpStatus}${BOT_WALL.test(result.title ?? "") ? ` / bot protection ("${result.title}")` : ""}`;
    } else {
      result.ok = true;
    }

    // Mobile rendering (best effort).
    await captureMobile(browser, site.url, path.join(dir, "screenshot-mobile.png"), cfg.userAgent, cfg.navigationTimeoutMs)
      .then((ok) => {
        if (ok) result.files.screenshotMobile = rel(path.join(dir, "screenshot-mobile.png"));
        else result.warnings.push("mobile screenshot failed");
      })
      .catch(() => result.warnings.push("mobile screenshot failed"));
  } catch (err) {
    result.error = err instanceof Error ? err.message.split("\n")[0] : String(err);
  } finally {
    await context?.close().catch(() => undefined);
  }

  if (cfg.useFaceliftCrawler && result.httpStatus !== undefined) {
    await faceliftCrawlStep(ctx, site, dir, log, result);
  }
  result.durationMs = Date.now() - started;
  return result;
}

async function dismissCookieBanner(page: Page): Promise<void> {
  for (const selector of COOKIE_SELECTORS) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 300 })) {
        await button.click({ timeout: 1500 });
        await page.waitForTimeout(400);
        return;
      }
    } catch {
      // try the next selector
    }
  }
}

async function autoScroll(page: Page): Promise<void> {
  await page
    .evaluate(`(async () => {
      const max = Math.min(document.documentElement.scrollHeight, 20000);
      for (let y = 0; y < max; y += Math.round(window.innerHeight * 0.8)) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    })()`)
    .catch(() => undefined);
  await page.waitForTimeout(500);
}

async function saveAssets(responses: Response[], dir: string, maxAssets: number, maxBytes: number): Promise<number> {
  const manifest: Array<{ url: string; file: string; type: string; bytes: number }> = [];
  const seen = new Set<string>();
  for (const resp of responses) {
    if (manifest.length >= maxAssets) break;
    const url = resp.url();
    if (seen.has(url) || !resp.ok()) continue;
    seen.add(url);
    try {
      const body = await resp.body();
      if (body.length === 0 || body.length > maxBytes) continue;
      const type = resp.request().resourceType() === "stylesheet" ? "css" : "js";
      const base = slugify(path.basename(new URL(url).pathname) || "asset", 50);
      const file = path.join(dir, type, `${String(manifest.length + 1).padStart(3, "0")}-${base}.${type}`);
      await fs.ensureDir(path.dirname(file));
      await fs.writeFile(file, body);
      manifest.push({ url, file: path.relative(dir, file).split(path.sep).join("/"), type, bytes: body.length });
    } catch {
      // body unavailable (redirect / evicted) — skip
    }
  }
  if (manifest.length) await writeJson(path.join(dir, "assets.json"), manifest);
  return manifest.length;
}

async function captureMobile(browser: Browser, url: string, file: string, userAgent: string, timeoutMs: number): Promise<boolean> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent, locale: "es-MX" });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(1200);
    await dismissCookieBanner(page);
    const height = Number(await page.evaluate("document.documentElement.scrollHeight").catch(() => 844));
    await page.screenshot({ path: file, fullPage: true, clip: height > 8000 ? { x: 0, y: 0, width: 390, height: 8000 } : undefined });
    return true;
  } catch {
    return false;
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function faceliftCrawlStep(ctx: FactoryContext, site: InspirationSite, dir: string, log: Logger, result: AcquisitionResult): Promise<void> {
  try {
    const { faceliftCrawl } = await import("../tools/run-facelift.js");
    const destDir = path.join(dir, "facelift-crawl");
    const crawl = await faceliftCrawl({
      ctx,
      url: result.finalUrl ?? site.url,
      destDir,
      maxPages: 1 + ctx.config.acquisition.crawlDepth,
      maxAssets: ctx.config.acquisition.maxAssets,
      logger: log,
    });
    if (crawl.ok && crawl.files > 0) {
      result.methods.push("facelift-crawler");
      result.files.faceliftCrawlDir = toPosixRelative(ctx.paths.root, destDir);
      result.assetCount = Math.max(result.assetCount, crawl.files);
      // A successful raw crawl is enough to treat a non-JS site as acquired.
      if (!result.ok && !result.error?.includes("bot")) result.ok = Boolean(result.files.domSnapshot);
    } else if (crawl.error) {
      result.warnings.push(`site-facelift crawler: ${crawl.error}`);
    }
  } catch (err) {
    result.warnings.push(`site-facelift crawler unavailable: ${err instanceof Error ? err.message : String(err)}`);
  }
}
