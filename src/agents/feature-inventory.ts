import path from "node:path";
import fs from "fs-extra";
import pLimit from "p-limit";
import {
  FeatureManifestSchema,
  UnionManifestSchema,
  type AnalyzerRun,
  type Feature,
  type FeatureLayout,
  type FeatureManifest,
  type UnionFeature,
  type UnionManifest,
} from "../schemas/feature-manifest.js";
import type { DomSection, DomSnapshot } from "../tools/dom-snapshot.js";
import { ensureClooney, normalizeClooneyComponents, runClooneyAnalysis } from "../tools/run-clooney.js";
import type { FeatureInventoryResult, InspirationSite, PipelineRun } from "../types/pipeline.js";
import type { FactoryContext, FeatureMap } from "../utils/config.js";
import { readJson, readJsonIfExists, toPosixRelative, writeJson } from "../utils/file-utils.js";
import { isoTimestamp } from "../utils/logger.js";
import { loadAcquisition } from "./site-acquirer.js";

/**
 * Phases 3–4 — inventory the features of every inspirational site and compute their union.
 * Two analyzers run per URL: Clooney-Agent (AI vision; needs GEMINI_API_KEY) and a built-in heuristic
 * analyzer over the Playwright DOM snapshot. Results merge by feature type; a baseline set is used
 * when nothing could be detected. Every type in the union is rendered on every generated site.
 */

const PHASE_INVENTORY = "PHASE_3_FEATURE_INVENTORY" as const;

// ---------------------------------------------------------------------------
// Heuristic analyzer
// ---------------------------------------------------------------------------

interface Detection {
  confidence: number;
  layout: FeatureLayout;
  components: string[];
  interactions: string[];
  evidence: string[];
  name?: string;
  description?: string;
}

const lower = (s: string) => s.toLowerCase();

function kwRegex(kw: string): RegExp {
  const escaped = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9áéíóúñü])${escaped}($|[^a-z0-9áéíóúñü])`, "i");
}

function hits(corpus: string, keywords: string[]): string[] {
  return keywords.filter((kw) => kwRegex(kw).test(corpus));
}

function sectionCorpus(s: DomSection): string {
  return lower(`${s.heading} ${s.id} ${s.classes} ${s.text.slice(0, 200)}`);
}

function layoutOf(s: DomSection | undefined, fallback: FeatureLayout = "contained"): FeatureLayout {
  if (!s) return fallback;
  if (s.sticky) return "sticky";
  if (s.horizontalScroll) return "carousel";
  if (s.gridLike) return "grid";
  if (s.listItems >= 4) return "list";
  if (s.fullWidth) return "full-width";
  return fallback;
}

const uniq = <T>(arr: T[]) => [...new Set(arr)];

/** Analyze a DOM snapshot and return detected features (one per type). */
export function analyzeDomSnapshot(snapshot: DomSnapshot, url: string, featureMap: FeatureMap): Feature[] {
  const ignored = featureMap.ignoredKeywords.map(lower);
  const isIgnored = (text: string) => ignored.some((k) => lower(text).includes(k));
  const sections = snapshot.sections.filter((s) => !isIgnored(`${s.classes} ${s.id}`) || s.tag === "footer");
  const headingText = lower(snapshot.headings.map((h) => h.text).join(" | "));
  const linkText = lower([...snapshot.links.texts, ...snapshot.buttons].join(" | "));
  const classText = snapshot.classTokens.join(" ");
  const vh = snapshot.viewport.height || 900;
  const kw = (type: string) => featureMap.featureTypes[type]?.keywords ?? [];
  const sectionFor = (type: string) => sections.find((s) => hits(sectionCorpus(s), kw(type)).length > 0);
  const keywordConfidence = (type: string) => {
    const h = hits(headingText, kw(type)).length;
    const l = hits(linkText, kw(type)).length;
    const c = hits(classText, kw(type)).length;
    return {
      score: 0.3 * Math.min(h, 2) / 2 + 0.2 * Math.min(l, 3) / 3 + 0.15 * Math.min(c, 3) / 3,
      evidence: [
        ...hits(headingText, kw(type)).slice(0, 3).map((k) => `heading:"${k}"`),
        ...hits(linkText, kw(type)).slice(0, 2).map((k) => `link:"${k}"`),
        ...hits(classText, kw(type)).slice(0, 2).map((k) => `class:${k}`),
      ],
    };
  };
  const detections = new Map<string, Detection>();
  const add = (type: string, d: Detection) => {
    if (d.confidence >= 0.4) detections.set(type, { ...d, confidence: Math.min(1, Math.round(d.confidence * 100) / 100) });
  };

  // navigation
  {
    const navSection = sections.find((s) => (s.tag === "nav" || s.tag === "header") && s.top < 300);
    const toggle = /hamburger|burger|menu-toggle|nav-toggle|navbar-toggler|mobile-menu/.test(classText) || /\bmenu\b|\bmenú\b/.test(linkText);
    const conf = (snapshot.landmarks.nav ? 0.5 : 0) + (snapshot.landmarks.header ? 0.25 : 0) + (navSection ? 0.2 : 0) + (snapshot.links.anchors.length >= 2 ? 0.05 : 0);
    add("navigation", {
      confidence: conf,
      layout: navSection?.sticky || snapshot.fixedElements > 0 ? "sticky" : "full-width",
      components: uniq(["logo", "links", ...(toggle ? ["menu-toggle"] : []), ...(snapshot.links.social.length ? ["social-icons"] : [])]),
      interactions: uniq([...(toggle ? ["menu-toggle"] : []), ...(navSection?.sticky ? ["sticky-nav"] : []), "anchor-scroll"]),
      evidence: [`landmarks nav=${snapshot.landmarks.nav} header=${snapshot.landmarks.header}`],
    });
  }

  // hero
  {
    const hero =
      sections.find((s) => s.top < vh * 0.6 && s.height >= vh * 0.45 && s.tag !== "nav" && s.tag !== "header" && (s.heading || s.images > 0 || s.hasBackgroundImage || s.videos > 0)) ??
      sections.find((s) => s.top < vh && s.height >= vh * 0.35 && (s.hasBackgroundImage || s.videos > 0));
    const k = keywordConfidence("hero");
    if (hero) {
      const media = hero.videos > 0 ? "background-video" : hero.hasBackgroundImage ? "background-image" : hero.images > 0 ? "image" : null;
      const layout: FeatureLayout = hero.hasBackgroundImage || hero.videos > 0 ? (hero.fullWidth ? "full-width" : "overlay") : hero.images > 0 && !hero.fullWidth ? "split" : layoutOf(hero, "full-width");
      add("hero", {
        confidence: 0.6 + (hero.heading ? 0.15 : 0) + (media ? 0.15 : 0) + k.score * 0.3,
        layout,
        components: uniq(["heading", ...(hero.text.length > hero.heading.length + 20 ? ["subheading"] : []), ...(hero.buttons > 0 || hero.links > 0 ? ["button"] : []), ...(media ? [media] : [])]),
        interactions: uniq([...(hero.buttons > 0 || hero.links > 0 ? ["cta-click"] : []), ...(/scroll/.test(sectionCorpus(hero)) ? ["scroll-indicator"] : [])]),
        evidence: [`first section ${hero.tag}#${hero.id || "-"} ${hero.width}x${hero.height}`, ...k.evidence],
        name: `${layout === "full-width" ? "Full-width" : layout === "split" ? "Split" : "Overlay"} Hero${media === "background-video" ? " with Background Video" : media === "background-image" ? " with Background Image" : media === "image" ? " with Featured Image" : ""}`,
      });
    }
  }

  // newsletter
  {
    const forms = snapshot.forms.filter(
      (f) =>
        (f.inputTypes.includes("email") || f.inputNames.some((n) => /e-?mail|correo|newsletter|subscribe/.test(n))) &&
        f.inputTypes.filter((t) => t !== "hidden" && t !== "submit").length <= 5 &&
        !/password|contraseña|search|buscar|login|cookie/.test(lower(`${f.text} ${f.inputNames.join(" ")}`)),
    );
    const k = keywordConfidence("newsletter");
    const section = sectionFor("newsletter");
    add("newsletter", {
      confidence: (forms.length ? 0.7 : 0) + k.score + (section ? 0.1 : 0),
      layout: section ? layoutOf(section, "inline") : "inline",
      components: uniq(["heading", "email-input", "submit-button", ...(forms.some((f) => f.inputTypes.includes("checkbox")) ? ["consent-checkbox"] : [])]),
      interactions: ["form-submit", "validation"],
      evidence: [...forms.slice(0, 2).map((f) => `form[${f.inputTypes.join(",")}] "${f.buttonText}"`), ...k.evidence],
    });
  }

  // tour-dates
  {
    const widget = snapshot.scriptHosts.some((h) => /bandsintown|seated|songkick|ticketmaster|livenation|axs/.test(h)) || snapshot.iframes.some((f) => /bandsintown|seated|songkick|ticketmaster/.test(f.host));
    const k = keywordConfidence("tour-dates");
    const section = sectionFor("tour-dates");
    add("tour-dates", {
      confidence: (widget ? 0.6 : 0) + (snapshot.dateLikeCount >= 3 ? 0.25 : 0) + (snapshot.links.ticketing.length ? 0.2 : 0) + k.score,
      layout: section ? layoutOf(section, "list") : "list",
      components: uniq(["date", "venue", "city", "ticket-button", ...(widget ? ["tour-widget"] : [])]),
      interactions: ["ticket-click"],
      evidence: [`dates=${snapshot.dateLikeCount}`, `ticket links=${snapshot.links.ticketing.length}`, ...(widget ? ["tour widget script"] : []), ...k.evidence],
    });
  }

  // discography
  {
    const k = keywordConfidence("discography");
    const coverSection = sections.find((s) => s.squareImages >= 3 && hits(sectionCorpus(s), kw("discography")).length > 0) ?? sections.find((s) => s.squareImages >= 4);
    add("discography", {
      confidence: k.score + (coverSection ? 0.35 : 0) + (snapshot.links.streaming.length >= 2 ? 0.15 : 0) + (snapshot.images.square >= 4 ? 0.1 : 0),
      layout: coverSection ? layoutOf(coverSection, "grid") : "grid",
      components: ["album-cover", "title", "year", "streaming-links"],
      interactions: uniq(["listen-click", ...(coverSection?.horizontalScroll ? ["carousel-swipe"] : []), "hover"]),
      evidence: [`square images=${snapshot.images.square}`, ...k.evidence],
    });
  }

  // top-songs
  {
    const k = keywordConfidence("top-songs");
    const section = sectionFor("top-songs");
    add("top-songs", {
      confidence: k.score + (section && section.listItems >= 3 ? 0.25 : 0) + (snapshot.media.audios > 0 ? 0.2 : 0),
      layout: section ? layoutOf(section, "list") : "list",
      components: ["track-number", "title", "duration", "play-button"],
      interactions: ["audio-preview"],
      evidence: [...k.evidence, `audio=${snapshot.media.audios}`],
    });
  }

  // video
  {
    const videoFrames = snapshot.iframes.filter((f) => /youtube|youtu\.be|vimeo/.test(f.host));
    const k = keywordConfidence("video");
    const section = sectionFor("video");
    add("video", {
      confidence: (videoFrames.length ? 0.6 : 0) + (snapshot.links.social.some((s) => s.platform === "youtube" && /watch|shorts/.test(s.href)) ? 0.2 : 0) + k.score + (snapshot.media.videos > 1 ? 0.15 : 0),
      layout: section ? layoutOf(section, "grid") : videoFrames.length > 1 ? "grid" : "contained",
      components: ["video-embed", "thumbnail", "play-button", "title"],
      interactions: ["video-play"],
      evidence: [`video iframes=${videoFrames.length}`, `video tags=${snapshot.media.videos}`, ...k.evidence],
    });
  }

  // music-player
  {
    const players = snapshot.media.embeddedPlayers.filter((h) => /spotify|apple|soundcloud|deezer|bandcamp|audiomack/.test(h));
    const k = keywordConfidence("music-player");
    add("music-player", {
      confidence: (players.length ? 0.75 : 0) + (snapshot.links.streaming.length >= 3 ? 0.2 : 0) + k.score * 0.5,
      layout: "contained",
      components: uniq(["embedded-player", "platform-links"]),
      interactions: ["play", "platform-click"],
      evidence: [...players.map((p) => `embed:${p}`), `streaming links=${snapshot.links.streaming.length}`],
    });
  }

  // social-links
  {
    const platforms = uniq(snapshot.links.social.map((s) => s.platform));
    add("social-links", {
      confidence: platforms.length >= 2 ? 0.6 + Math.min(platforms.length, 6) * 0.06 : platforms.length * 0.3,
      layout: "inline",
      components: ["icon-links"],
      interactions: ["external-link"],
      evidence: [`platforms: ${platforms.join(", ")}`],
    });
  }

  // photo-gallery
  {
    const k = keywordConfidence("photo-gallery");
    const gallery = sections.find((s) => s.images >= 6 && s.gridLike && hits(sectionCorpus(s), kw("discography")).length === 0);
    const lightbox = /lightbox|fancybox|photoswipe|glightbox|modal/.test(classText);
    add("photo-gallery", {
      confidence: k.score + (gallery ? 0.35 : 0) + (lightbox ? 0.15 : 0),
      layout: gallery ? layoutOf(gallery, "grid") : "grid",
      components: uniq(["image-grid", ...(lightbox ? ["lightbox"] : [])]),
      interactions: uniq([...(lightbox ? ["lightbox-open"] : []), "hover"]),
      evidence: [...(gallery ? [`grid with ${gallery.images} images`] : []), ...k.evidence],
    });
  }

  // press-quotes
  {
    const quotes = snapshot.blockquotes.filter((q) => q.length > 30);
    const k = keywordConfidence("press-quotes");
    add("press-quotes", {
      confidence: (quotes.length ? 0.5 + Math.min(quotes.length, 3) * 0.08 : 0) + k.score,
      layout: quotes.length > 2 ? "carousel" : "contained",
      components: ["quote", "attribution"],
      interactions: quotes.length > 2 ? ["carousel-swipe"] : [],
      evidence: [`quotes=${quotes.length}`, ...k.evidence],
    });
  }

  // merch
  {
    const shop = snapshot.scriptHosts.some((h) => /shopify|bigcartel|myshopify/.test(h));
    const k = keywordConfidence("merch");
    add("merch", {
      confidence: (snapshot.links.store.length ? 0.45 : 0) + (shop ? 0.3 : 0) + k.score,
      layout: "grid",
      components: ["product-card", "price", "buy-button"],
      interactions: ["shop-click"],
      evidence: [`store links=${snapshot.links.store.length}`, ...(shop ? ["shop platform script"] : []), ...k.evidence],
    });
  }

  // contact
  {
    const k = keywordConfidence("contact");
    add("contact", {
      confidence: (snapshot.links.mailto.length ? 0.5 : 0) + (snapshot.links.tel.length ? 0.1 : 0) + k.score,
      layout: "contained",
      components: uniq(["email-link", ...(snapshot.links.tel.length ? ["phone-link"] : [])]),
      interactions: ["mailto"],
      evidence: [`mailto=${snapshot.links.mailto.length}`, ...k.evidence],
    });
  }

  // stats
  {
    const numbers = (snapshot.textSample.match(/\b\d+(?:[.,]\d+)?\s?(?:m|k|b|\+|million|millones|billion|mil)\b/gi) ?? []).length;
    const k = keywordConfidence("stats");
    const counter = /counter|count-up|countup|odometer|stat/.test(classText);
    add("stats", {
      confidence: (numbers >= 3 ? 0.3 : 0) + (counter ? 0.3 : 0) + k.score,
      layout: "full-width",
      components: ["number", "label"],
      interactions: counter ? ["count-up"] : [],
      evidence: [`big numbers=${numbers}`, ...(counter ? ["counter classes"] : []), ...k.evidence],
    });
  }

  // countdown / news / fan-club / lyrics
  for (const type of ["countdown", "news", "fan-club", "lyrics"] as const) {
    const k = keywordConfidence(type);
    const structural = type === "countdown" && snapshot.countdownLike ? 0.5 : 0;
    add(type, {
      confidence: k.score * 1.3 + structural,
      layout: type === "news" ? "grid" : "contained",
      components: type === "countdown" ? ["timer", "cta"] : type === "news" ? ["article-card", "date", "read-more"] : type === "fan-club" ? ["join-cta", "benefits"] : ["lyrics-text"],
      interactions: type === "countdown" ? ["timer-tick"] : ["link-click"],
      evidence: [...k.evidence, ...(structural ? ["countdown-like text"] : [])],
    });
  }

  // footer
  add("footer", {
    confidence: snapshot.landmarks.footer ? 0.95 : 0.5,
    layout: "full-width",
    components: uniq(["copyright", "links", ...(snapshot.links.social.length ? ["social-icons"] : [])]),
    interactions: [],
    evidence: [`footer landmark=${snapshot.landmarks.footer}`],
  });

  return [...detections.entries()].map(([type, d]) => toFeature(type, d, url, featureMap));
}

function toFeature(type: string, d: Detection, url: string, featureMap: FeatureMap): Feature {
  const label = featureMap.featureTypes[type]?.label ?? type;
  const layoutLabel = d.layout === "unknown" ? "" : `${d.layout.replace("-", " ")} `;
  return {
    id: `${type}-section`,
    type,
    name: d.name ?? `${layoutLabel.charAt(0).toUpperCase()}${layoutLabel.slice(1)}${label}`.trim(),
    description:
      d.description ??
      `${label} (${d.layout}) with ${d.components.join(", ")}${d.interactions.length ? `; interactions: ${d.interactions.join(", ")}` : ""}.`,
    layout: d.layout,
    components: d.components,
    interactions: d.interactions,
    source: { url, detector: "heuristic", confidence: d.confidence },
    evidence: d.evidence.filter(Boolean).slice(0, 8),
  };
}

function baselineFeatures(url: string | null, featureMap: FeatureMap, detector: "baseline" | "required"): Feature[] {
  return featureMap.baseline.map((type) => {
    const def = featureMap.featureTypes[type];
    return {
      id: `${type}-section`,
      type,
      name: def?.label ?? type,
      description: `${def?.label ?? type} (${detector === "baseline" ? "baseline feature set" : "required on every site"}).`,
      layout: type === "hero" || type === "footer" ? ("full-width" as const) : ("contained" as const),
      components: [],
      interactions: [],
      source: { url, detector, confidence: detector === "required" ? 1 : 0.5 },
      evidence: [],
    };
  });
}

/** Merge feature lists by type: keep the highest-confidence base, union components/interactions/evidence. */
function mergeByType(lists: Feature[][]): Feature[] {
  const byType = new Map<string, Feature>();
  for (const f of lists.flat()) {
    const existing = byType.get(f.type);
    if (!existing) {
      byType.set(f.type, { ...f, components: [...f.components], interactions: [...f.interactions], evidence: [...f.evidence] });
      continue;
    }
    const base = f.source.confidence > existing.source.confidence ? { ...f } : existing;
    base.components = uniq([...existing.components, ...f.components]);
    base.interactions = uniq([...existing.interactions, ...f.interactions]);
    base.evidence = uniq([...existing.evidence, ...f.evidence]).slice(0, 12);
    base.source = { ...base.source, confidence: Math.max(existing.source.confidence, f.source.confidence) };
    byType.set(f.type, base);
  }
  return [...byType.values()];
}

function manifestFile(ctx: FactoryContext, slug: string): string {
  return path.join(ctx.paths.featureManifestsDir, `${slug}.json`);
}

export async function loadFeatureManifest(ctx: FactoryContext, slug: string): Promise<FeatureManifest | null> {
  const file = manifestFile(ctx, slug);
  if (!(await fs.pathExists(file))) return null;
  const parsed = FeatureManifestSchema.safeParse(await readJson(file));
  return parsed.success ? parsed.data : null;
}

function orderTypes(types: Iterable<string>, featureMap: FeatureMap): string[] {
  const keys = Object.keys(featureMap.featureTypes);
  return [...new Set(types)].sort((a, b) => {
    const ia = keys.indexOf(a);
    const ib = keys.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

export async function buildFeatureInventories(run: PipelineRun): Promise<FeatureInventoryResult[]> {
  const { ctx, checkpoint } = run;
  const log = run.logger.child("features");
  const cfg = ctx.config.tools.clooney;
  const limit = pLimit(ctx.config.concurrency.urls);
  let clooneyWarned = false;

  return Promise.all(
    run.sites.map((site: InspirationSite) =>
      limit(async (): Promise<FeatureInventoryResult> => {
        const file = manifestFile(ctx, site.slug);
        if (checkpoint.isItemDone(PHASE_INVENTORY, site.slug)) {
          const previous = await loadFeatureManifest(ctx, site.slug);
          if (previous) return toResult(ctx, previous);
        }
        await checkpoint.setItem(PHASE_INVENTORY, site.slug, "running");
        log.info(`Phase 3: Inventorying features of ${site.url}`);
        const analyzers: AnalyzerRun[] = [];
        const lists: Feature[][] = [];

        // Heuristic DOM analyzer (always).
        let started = Date.now();
        const acquisition = await loadAcquisition(ctx, site.slug);
        const snapshotFile = acquisition?.files.domSnapshot ? path.join(ctx.paths.root, acquisition.files.domSnapshot) : null;
        if (acquisition?.ok && snapshotFile && (await fs.pathExists(snapshotFile))) {
          try {
            const snapshot = await readJson<DomSnapshot>(snapshotFile);
            const features = analyzeDomSnapshot(snapshot, site.url, ctx.featureMap);
            lists.push(features);
            analyzers.push({ name: "dom-heuristic", status: "ok", durationMs: Date.now() - started, detail: `${features.length} features` });
          } catch (err) {
            analyzers.push({ name: "dom-heuristic", status: "failed", durationMs: Date.now() - started, detail: err instanceof Error ? err.message : String(err) });
          }
        } else {
          analyzers.push({ name: "dom-heuristic", status: "skipped", durationMs: 0, detail: acquisition?.error ? `acquisition failed: ${acquisition.error}` : "no DOM snapshot" });
        }

        // Clooney-Agent (AI vision).
        started = Date.now();
        if (!cfg.enabled) {
          analyzers.push({ name: "clooney-agent", status: "skipped", durationMs: 0, detail: "disabled in config" });
        } else if (!ctx.env.geminiApiKey) {
          if (!clooneyWarned) log.warn("Clooney-Agent skipped: GEMINI_API_KEY not set (the built-in DOM analyzer is used)");
          clooneyWarned = true;
          analyzers.push({ name: "clooney-agent", status: "skipped", durationMs: 0, detail: "GEMINI_API_KEY not set" });
        } else if (acquisition && !acquisition.ok) {
          analyzers.push({ name: "clooney-agent", status: "skipped", durationMs: 0, detail: "site not reachable" });
        } else {
          const install = await ensureClooney(ctx, log);
          if (!install) {
            analyzers.push({ name: "clooney-agent", status: "failed", durationMs: Date.now() - started, detail: "Clooney-Agent could not be installed" });
          } else {
            const res = await runClooneyAnalysis(install, {
              url: site.url,
              outFile: path.join(ctx.paths.featureManifestsDir, `${site.slug}.clooney.json`),
              breakpoints: cfg.breakpoints,
              timeoutMs: cfg.timeoutMs,
              geminiApiKey: ctx.env.geminiApiKey,
              logger: log,
            });
            if (res.ok) {
              const features = normalizeClooneyComponents(res.components, site.url, ctx.featureMap);
              lists.push(features);
              analyzers.push({ name: "clooney-agent", status: "ok", durationMs: Date.now() - started, detail: `${res.components.length} components → ${features.length} features` });
            } else {
              log.warn(`Clooney-Agent analysis failed for ${site.url}: ${res.error}`);
              analyzers.push({ name: "clooney-agent", status: "failed", durationMs: Date.now() - started, detail: res.error });
            }
          }
        }

        let features = mergeByType(lists);
        const usedBaseline = features.length === 0;
        if (usedBaseline) {
          log.warn(`No features detected for ${site.url} — using the baseline feature set`);
          features = baselineFeatures(site.url, ctx.featureMap, "baseline");
        }
        const order = orderTypes(features.map((f) => f.type), ctx.featureMap);
        features.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
        const manifest = FeatureManifestSchema.parse({
          schemaVersion: 1,
          url: site.url,
          slug: site.slug,
          generatedAt: isoTimestamp(),
          analyzers,
          usedBaseline,
          features,
        });
        await writeJson(file, manifest);
        log.success(`${site.url}: ${features.length} feature types (${order.join(", ")})`);
        await checkpoint.setItem(PHASE_INVENTORY, site.slug, usedBaseline ? "degraded" : "completed");
        return toResult(ctx, manifest);
      }),
    ),
  );
}

function toResult(ctx: FactoryContext, m: FeatureManifest): FeatureInventoryResult {
  return {
    url: m.url,
    slug: m.slug,
    manifestFile: toPosixRelative(ctx.paths.root, manifestFile(ctx, m.slug)),
    usedBaseline: m.usedBaseline,
    featureTypes: m.features.map((f) => f.type),
    analyzers: m.analyzers,
  };
}

export async function computeFeatureUnion(run: PipelineRun): Promise<UnionManifest> {
  const { ctx } = run;
  const log = run.logger.child("union");
  const manifests: FeatureManifest[] = [];
  for (const site of run.sites) {
    const m = await loadFeatureManifest(ctx, site.slug);
    if (m) manifests.push(m);
    else log.warn(`No feature manifest for ${site.url} — it does not contribute to the union`);
  }

  const byType = new Map<string, UnionFeature>();
  for (const m of manifests) {
    for (const f of m.features) {
      const existing = byType.get(f.type);
      if (!existing) {
        byType.set(f.type, {
          ...f,
          id: `${f.type}-section`,
          sources: f.source.url ? [f.source.url] : [],
          layouts: [f.layout],
          mergedFrom: [`${m.slug}:${f.id}`],
        });
        continue;
      }
      const better = f.source.confidence > existing.source.confidence;
      byType.set(f.type, {
        ...(better ? { ...existing, name: f.name, description: f.description, layout: f.layout, source: f.source } : existing),
        components: uniq([...existing.components, ...f.components]),
        interactions: uniq([...existing.interactions, ...f.interactions]),
        evidence: uniq([...existing.evidence, ...f.evidence]).slice(0, 16),
        sources: uniq([...existing.sources, ...(f.source.url ? [f.source.url] : [])]),
        layouts: uniq([...existing.layouts, f.layout]),
        mergedFrom: [...existing.mergedFrom, `${m.slug}:${f.id}`],
      });
    }
  }

  // Types every site must render regardless of detection.
  for (const [type, def] of Object.entries(ctx.featureMap.featureTypes)) {
    if (!def.alwaysInclude || byType.has(type)) continue;
    const [feature] = baselineFeatures(null, { ...ctx.featureMap, baseline: [type] }, "required");
    byType.set(type, { ...feature, sources: [], layouts: [feature.layout], mergedFrom: [] });
  }

  const featureTypes = orderTypes(byType.keys(), ctx.featureMap);
  for (const f of byType.values()) {
    if (f.sources.length > 1) f.description = `${f.description} Seen on ${f.sources.length} inspiration sites.`;
  }
  const union = UnionManifestSchema.parse({
    schemaVersion: 1,
    generatedAt: isoTimestamp(),
    sourceUrls: run.sites.map((s) => s.url),
    featureTypes,
    features: featureTypes.map((t) => byType.get(t)!),
  });
  await writeJson(path.join(ctx.paths.featureManifestsDir, "UNION.json"), union);
  log.info(`Union contains ${featureTypes.length} unique feature types: [${featureTypes.join(", ")}]`);
  return union;
}

export async function loadUnion(ctx: FactoryContext): Promise<UnionManifest> {
  const file = path.join(ctx.paths.featureManifestsDir, "UNION.json");
  const data = await readJsonIfExists<unknown>(file, null);
  if (!data) throw new Error(`Feature union not found at ${file} — run phase 4 first`);
  return UnionManifestSchema.parse(data);
}
