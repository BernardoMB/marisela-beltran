import { buildUserPrompt, compileSpecStream, formatSpecIssues, validateSpec, autoFixSpec, type Spec } from "@json-render/core";
import type { ArtistContent } from "../schemas/content-schema.js";
import type { UnionManifest } from "../schemas/feature-manifest.js";
import type { CatalogBundle } from "../generators/component-registry.js";
import { checkSpecCoverage } from "../generators/spec-renderer.js";
import type { DesignBrief } from "../utils/config.js";
import { generateText, type Effort } from "../utils/llm.js";
import type { Logger } from "../utils/logger.js";

/**
 * json-render generation with Claude: the catalog's own prompt (catalog.prompt) constrains the model to
 * our components; the design brief steers the composition; the fetched content is provided as state to
 * BIND to (never to copy into new facts). Output is JSONL RFC-6902 patches compiled with compileSpecStream.
 */

const FACTORY_RULES = [
  "NEVER output /state patches. The data already exists in AVAILABLE STATE; bind data props with { \"$state\": \"/path\" } using ONLY the allowed paths listed in the request.",
  "Never invent facts, names, dates, numbers, awards, quotes or URLs. Literal text must be interface copy (section titles, eyebrows, intros, button labels, invitations) or wording copied from AVAILABLE STATE.",
  "The root element is a Page. Page.children lists the sections in display order: NavBar first, then the sections (and optional SectionDividers), Footer last. Every other element has \"children\": [].",
  "Do not use repeat, visible, on or watch. This is a static marketing page.",
  "Include exactly one element for each required feature type listed in the request (FeatureSection once per extra feature type, with its featureType). Use SectionDivider at most 4 times.",
  "Use the anchorId values given in the request. In-page links must be \"#<anchorId>\" of sections that exist.",
  "Use only variant/layout values allowed by each component's enum.",
  "Output only JSONL patch lines — no prose, no code fences.",
];

export interface LLMSpecResult {
  spec: Spec;
  attempts: number;
  prompts: { system: string; user: string };
  issues: string[];
  rawOutputs: string[];
}

/** Compact, token-cheap view of the content for the model (counts + samples + key scalars). */
export function compactState(content: ArtistContent): Record<string, unknown> {
  return {
    name: content.name,
    aliases: content.aliases,
    tagline: content.tagline,
    shortBio: content.shortBio,
    lang: content.lang,
    biography: { summary: content.biography.summary, paragraphs: `${content.biography.paragraphs.length} paragraphs`, facts: content.biography.facts, debutYear: content.biography.debutYear, sourceNote: content.biography.sourceNote },
    discography: { count: content.discography.length, sample: content.discography.slice(0, 5).map((a) => ({ title: a.title, year: a.year, type: a.type, hasCover: Boolean(a.cover) })) },
    topSongs: { count: content.topSongs.length, sample: content.topSongs.slice(0, 5).map((s) => s.title) },
    tourDates: { count: content.tourDates.length, sample: content.tourDates.slice(0, 3) },
    tour: content.tour,
    videos: { count: content.videos.length, sample: content.videos.slice(0, 3).map((v) => v.title) },
    images: { hero: Boolean(content.images.hero), portrait: Boolean(content.images.portrait), gallery: content.images.gallery.length },
    socialLinks: content.socialLinks.map((l) => l.platform),
    pressQuotes: { count: content.pressQuotes.length, sample: content.pressQuotes.slice(0, 2) },
    stats: { items: content.stats.items },
    news: { count: content.news.length },
    contact: { bookingEmail: Boolean(content.contact.bookingEmail), bookingUrl: Boolean(content.contact.bookingUrl) },
    spotifyArtistId: Boolean(content.spotifyArtistId),
    officialSite: content.officialSite,
  };
}

/** Extract JSONL patch lines from model text (tolerates fences, prose and truncated lines). */
export function extractJsonl(text: string): string {
  return text
    .replace(/```(?:jsonl?|json)?/gi, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("{") && l.endsWith("}") && l.includes('"op"'))
    .filter((l) => {
      try {
        JSON.parse(l);
        return true;
      } catch {
        return false;
      }
    })
    .join("\n");
}

function taskPrompt(opts: { bundle: CatalogBundle; brief: DesignBrief; lang: "es" | "en"; union: UnionManifest }): string {
  const { bundle, brief, lang } = opts;
  const required = bundle.requiredFeatureTypes.map((t) => {
    const comp = bundle.componentByFeature[t];
    const anchor = bundle.anchors[t];
    return `- ${t} → ${comp}${comp === "FeatureSection" ? ` (featureType "${t}")` : ""}${anchor ? `, anchorId "${anchor}"` : ""}`;
  });
  const language = lang === "es" ? "Spanish (Mexico)" : "English";
  return [
    `Compose the homepage of the official website of the artist described in AVAILABLE STATE, as the "${brief.name}" design brief in the system prompt directs (${brief.keyCharacteristics}).`,
    "",
    "Required elements (exactly one each):",
    ...required,
    "",
    `Bind data ONLY with these $state paths: ${bundle.allowedStatePaths.join(", ")}.`,
    `Write every visible text in ${language}, in the voice of the brief. Hero.title, NavBar.brand and Footer.brand are the artist name from /name.`,
    "Choose the section order, the layout variants and up to 4 SectionDividers to express the brief. Keep the Hero first.",
    "Page props: title (artist name + tagline), description (one sentence from /shortBio), lang.",
  ].join("\n");
}

export async function generateSpecWithLLM(opts: {
  bundle: CatalogBundle;
  brief: DesignBrief;
  briefPrompt: string;
  content: ArtistContent;
  union: UnionManifest;
  lang: "es" | "en";
  model: string;
  effort: Effort;
  maxTokens: number;
  maxRepairAttempts: number;
  logger: Logger;
  llm?: typeof generateText;
}): Promise<LLMSpecResult> {
  const llm = opts.llm ?? generateText;
  const system = opts.bundle.catalog.prompt({
    system: `${opts.briefPrompt.trim()}\n\nYou are the art director composing this page from a fixed component catalog. The visual styling of every component is already implemented for this brief; your job is the composition: which sections, in what order, which variants, and the interface copy.`,
    customRules: [...FACTORY_RULES, ...opts.brief.jsonRenderRules],
  });
  const state = compactState(opts.content);
  const task = taskPrompt(opts);
  let user = buildUserPrompt({ prompt: task, state });
  const rawOutputs: string[] = [];
  let best: { spec: Spec; issues: string[] } | null = null;

  for (let attempt = 1; attempt <= opts.maxRepairAttempts + 1; attempt++) {
    const res = await llm({ system, prompt: user, model: opts.model, effort: opts.effort, maxTokens: opts.maxTokens, label: `json-render:${opts.brief.id}#${attempt}`, logger: opts.logger });
    rawOutputs.push(res.text);
    const jsonl = extractJsonl(res.text);
    let spec: Spec | null = null;
    const issues: string[] = [];
    if (!jsonl) {
      issues.push("The output contained no JSONL patch lines.");
    } else {
      try {
        const compiled = compileSpecStream<Record<string, unknown>>(jsonl) as Record<string, unknown>;
        delete compiled.state; // never accept model-invented state
        spec = compiled as unknown as Spec;
        const lastAttempt = attempt === opts.maxRepairAttempts + 1;
        spec = autoFixSpec(spec, { lossy: lastAttempt }).spec;
        const structural = validateSpec(spec);
        if (!structural.valid) issues.push(formatSpecIssues(structural.issues));
        const catalogCheck = opts.bundle.catalog.validate(spec) as { success: boolean; error?: { issues?: Array<{ path?: unknown[]; message?: string }>; message?: string } };
        if (!catalogCheck.success) {
          const list = catalogCheck.error?.issues?.slice(0, 15).map((i) => `${(i.path ?? []).join(".")}: ${i.message}`) ?? [catalogCheck.error?.message ?? "catalog validation failed"];
          issues.push(...list);
        }
        const coverage = checkSpecCoverage(spec, opts.bundle);
        if (coverage.missing.length) issues.push(`Missing required feature types: ${coverage.missing.join(", ")}`);
      } catch (err) {
        issues.push(`Could not compile the JSONL patches: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (spec && (!best || issues.length < best.issues.length)) best = { spec, issues };
    if (spec && issues.length === 0) {
      opts.logger.info(`json-render (${opts.brief.id}): valid spec from the LLM on attempt ${attempt}`);
      return { spec, attempts: attempt, prompts: { system, user }, issues: [], rawOutputs };
    }
    opts.logger.warn(`json-render (${opts.brief.id}) attempt ${attempt}: ${issues.length} issue(s) — ${issues.slice(0, 3).join(" | ").slice(0, 300)}`);
    user = buildUserPrompt({
      prompt: `${task}\n\nYour previous output had these problems:\n${issues.map((i) => `- ${i}`).join("\n")}\n\nOutput the COMPLETE corrected page again as JSONL patches.`,
      state,
    });
  }
  if (!best) throw new Error("the LLM never produced a compilable json-render spec");
  return { spec: best.spec, attempts: opts.maxRepairAttempts + 1, prompts: { system, user }, issues: best.issues, rawOutputs };
}
