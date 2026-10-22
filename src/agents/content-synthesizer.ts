import path from "node:path";
import fs from "fs-extra";
import { z } from "zod";
import {
  ContentDocumentSchema,
  type Album,
  type ArtistContent,
  type Biography,
  type ClaimCheck,
  type ContentDocument,
  type Fact,
  type ImageAsset,
  type LinkItem,
  type NewsItem,
  type Quote,
  type SocialLink,
  type SocialPlatform,
  type Song,
  type Stat,
  type TourEvent,
  type Video,
} from "../schemas/content-schema.js";
import { fetchAllSources, type RawSourceBundle, type SourceDoc } from "../tools/run-content-fetch.js";
import { platformFromUrl } from "../tools/providers/sources.js";
import { downloadImage, foldText, normalizeText, paragraphsFromText, splitSentences, titleKey } from "../tools/providers/web.js";
import type { PipelineRun } from "../types/pipeline.js";
import type { ArtistConfig, FactoryContext } from "../utils/config.js";
import { resolveAutoMode } from "../utils/config.js";
import { readJson, slugify, toPosixRelative, writeJson } from "../utils/file-utils.js";
import { describeLLMError, generateStructured, llmAvailable } from "../utils/llm.js";
import { isoTimestamp, type Logger } from "../utils/logger.js";

/**
 * Phase 5 — turn raw public data into the site-ready ArtistContent (+ provenance metadata).
 * Rules: nothing invented; every published claim must be corroborated by a fetched source;
 * Wikipedia-derived text is attributed (CC BY-SA 4.0); quotes are verbatim; tour dates only from
 * real event sources.
 */

const PHASE = "PHASE_5_CONTENT_SYNTHESIS" as const;
type Lang = "es" | "en";

const L = {
  es: {
    facts: { stageName: "Nombre artístico", birthName: "Nombre de nacimiento", born: "Nacimiento", birthPlace: "Lugar de nacimiento", origin: "Origen", debut: "Debut", alias: "Apodo", genres: "Géneros", active: "Años de actividad", labels: "Discográficas" },
    present: "presente",
    since: "Desde",
    stats: { albums: "Álbumes de estudio", deezer: "Seguidores en Deezer", listeners: "Oyentes mensuales en Spotify", years: "Años de trayectoria", releases: "Lanzamientos" },
    coverAlt: (t: string, y?: number) => `Portada del álbum «${t}»${y ? ` (${y})` : ""}`,
    photoAlt: (n: string) => `Fotografía de ${n}`,
    photo: "Foto",
    coversCredit: "Portadas de álbumes © sus respectivos titulares.",
    profileCredit: "Foto de perfil: Deezer (© sus respectivos titulares).",
    bioNote: (s: string[]) => `Texto basado en ${s.join(" y ")}${s.some((x) => x.startsWith("Wikipedia")) ? " (Wikipedia: CC BY-SA 4.0)" : ""}.`,
    officialSite: "el sitio oficial",
    wikipedia: "Wikipedia",
  },
  en: {
    facts: { stageName: "Stage name", birthName: "Birth name", born: "Born", birthPlace: "Birthplace", origin: "Origin", debut: "Debut", alias: "Nickname", genres: "Genres", active: "Years active", labels: "Labels" },
    present: "present",
    since: "Since",
    stats: { albums: "Studio albums", deezer: "Deezer fans", listeners: "Spotify monthly listeners", years: "Years of career", releases: "Releases" },
    coverAlt: (t: string, y?: number) => `Cover of the album “${t}”${y ? ` (${y})` : ""}`,
    photoAlt: (n: string) => `Photograph of ${n}`,
    photo: "Photo",
    coversCredit: "Album covers © their respective owners.",
    profileCredit: "Profile photo: Deezer (© its respective owners).",
    bioNote: (s: string[]) => `Text based on ${s.join(" and ")}${s.some((x) => x.startsWith("Wikipedia")) ? " (Wikipedia: CC BY-SA 4.0)" : ""}.`,
    officialSite: "the official website",
    wikipedia: "Wikipedia",
  },
} as const;

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  spotify: "Spotify",
  "apple-music": "Apple Music",
  deezer: "Deezer",
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
  website: "Web",
  "amazon-music": "Amazon Music",
  soundcloud: "SoundCloud",
  other: "Link",
};

export function contentFile(ctx: FactoryContext): string {
  return path.join(ctx.paths.contentDir, "content.json");
}

export async function loadContent(ctx: FactoryContext): Promise<ContentDocument> {
  const file = contentFile(ctx);
  if (!(await fs.pathExists(file))) throw new Error(`Artist content not found at ${file} — run phase 5 first`);
  return ContentDocumentSchema.parse(await readJson(file));
}

// ---------------------------------------------------------------------------
// Claim verification
// ---------------------------------------------------------------------------

function snippet(doc: SourceDoc, index: number, length: number): string {
  const start = Math.max(0, index - 80);
  const end = Math.min(doc.text.length, index + length + 80);
  return `${start > 0 ? "…" : ""}${doc.text.slice(start, end).replace(/\s+/g, " ").trim()}${end < doc.text.length ? "…" : ""}`;
}

/** Verify config claims against the fetched documents (accent/case-insensitive) + structured facts. */
export function verifyClaims(
  claims: ArtistConfig["claimsToVerify"],
  docs: SourceDoc[],
  known: { birthDate?: string; birthPlace?: string; legalNames?: string[] },
): ClaimCheck[] {
  const folded = docs.map((d) => ({ doc: d, text: foldText(d.text) }));
  return claims.map((claim): ClaimCheck => {
    const sourceIds = new Set<string>();
    let evidence: string | undefined;
    for (const pattern of claim.patterns) {
      const p = normalizeText(pattern);
      if (!p) continue;
      for (const { doc, text } of folded) {
        const i = text.indexOf(p);
        if (i >= 0) {
          sourceIds.add(doc.sourceId);
          evidence ??= `${doc.name}: ${snippet(doc, i, p.length)}`;
        }
      }
    }
    // Structured contradictions (birth facts, legal name).
    const claimText = normalizeText(claim.claim);
    const isBirth = /\b(born|nacio|nacimiento|birth)\b/.test(claimText);
    const claimYear = claim.claim.match(/\b(19|20)\d{2}\b/)?.[0];
    if (isBirth && known.birthDate && claimYear && !known.birthDate.startsWith(claimYear)) {
      return {
        id: claim.id,
        claim: claim.claim,
        status: "contradicted",
        evidence: `Structured data (Wikidata/MusicBrainz): born ${known.birthDate}${known.birthPlace ? ` in ${known.birthPlace}` : ""}`,
        sourceIds: ["wikidata", "musicbrainz"],
        note: "Claimed birth year differs from public records.",
      };
    }
    if (/\b(real name|nombre real|legal name|nombre de nacimiento)\b/.test(claimText) && known.legalNames?.length && sourceIds.size === 0) {
      return {
        id: claim.id,
        claim: claim.claim,
        status: "contradicted",
        evidence: `Public records list: ${known.legalNames.join(" / ")}`,
        sourceIds: ["wikidata"],
        note: "Claimed legal name not found; sources give a different name.",
      };
    }
    if (sourceIds.size > 0) return { id: claim.id, claim: claim.claim, status: "verified", evidence, sourceIds: [...sourceIds] };
    return { id: claim.id, claim: claim.claim, status: "unverified", sourceIds: [], note: "No fetched source mentions this claim." };
  });
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const yearOf = (date?: string) => {
  const y = Number(date?.slice(0, 4));
  return Number.isFinite(y) && y > 1900 ? y : undefined;
};

function compactNumber(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

interface AlbumDraft extends Album {
  coverUrl?: string;
}

function buildDiscography(b: RawSourceBundle): AlbumDraft[] {
  const drafts: AlbumDraft[] = [];
  const seen = new Set<string>();
  const add = (a: AlbumDraft) => {
    const key = titleKey(a.title);
    if (!key || seen.has(key)) return;
    seen.add(key);
    drafts.push(a);
  };
  const SKIP = /remix|dj-mix|mixtape|demo|interview|spokenword|audiobook|audio drama/i;
  for (const g of b.musicbrainz?.releaseGroups ?? []) {
    if (g.secondaryTypes.some((t) => SKIP.test(t))) continue;
    const type: Album["type"] = g.secondaryTypes.includes("Compilation")
      ? "compilation"
      : g.secondaryTypes.includes("Live")
        ? "live"
        : g.primaryType === "EP"
          ? "ep"
          : g.primaryType === "Single"
            ? "single"
            : "album";
    add({ id: "", title: g.title, year: yearOf(g.firstReleaseDate), releaseDate: g.firstReleaseDate, type, links: {} });
  }
  if (!drafts.length) {
    for (const a of b.deezer?.albums ?? []) {
      if (a.recordType && !["album", "compile", "ep"].includes(a.recordType)) continue;
      add({ id: "", title: a.title, year: yearOf(a.releaseDate), releaseDate: a.releaseDate, type: a.recordType === "compile" ? "compilation" : a.recordType === "ep" ? "ep" : "album", links: {} });
    }
  }
  // Enrich with covers / links / missing years.
  for (const d of drafts) {
    const key = titleKey(d.title);
    const it = b.itunes?.albums.find((a) => titleKey(a.title) === key) ?? b.itunes?.albums.find((a) => titleKey(a.title).startsWith(key) && key.length > 6);
    const dz = b.deezer?.albums.find((a) => titleKey(a.title) === key) ?? b.deezer?.albums.find((a) => titleKey(a.title).startsWith(key) && key.length > 6);
    if (it?.url) d.links.appleMusic = it.url;
    if (dz?.link) d.links.deezer = dz.link;
    d.coverUrl = it?.artwork ?? dz?.coverXl;
    d.year ??= yearOf(it?.releaseDate) ?? yearOf(dz?.releaseDate);
    d.releaseDate ??= it?.releaseDate ?? dz?.releaseDate;
    if (it?.trackCount) d.trackCount = it.trackCount;
  }
  drafts.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));
  const debut = drafts.find((d) => d.type === "album" && d.year);
  for (const d of drafts) {
    d.id = `album-${slugify(d.title, 40)}${d.year ? `-${d.year}` : ""}`;
    if (d === debut) d.highlight = true;
  }
  return drafts.slice(0, 40);
}

function buildTopSongs(b: RawSourceBundle, albums: Album[], locale: string, max: number): Song[] {
  const plays = new Map((b.spotify?.popular ?? []).map((p) => [titleKey(p.title), p.plays]));
  const albumByKey = new Map(albums.map((a) => [titleKey(a.title), a]));
  const songs: Song[] = [];
  const seen = new Set<string>();
  for (const t of b.deezer?.top ?? []) {
    const key = titleKey(t.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    // Deezer often drops accents: borrow the properly-accented title when an album shares the name.
    const title = albumByKey.get(key)?.title ?? t.title;
    const album = t.album ? (albumByKey.get(titleKey(t.album.title))?.title ?? t.album.title) : undefined;
    const raw = plays.get(key);
    const streams = raw ? compactNumber(Number(raw.replace(/[^\d]/g, "")), locale) : undefined;
    songs.push({
      id: `song-${slugify(title, 40)}`,
      title,
      album,
      year: album ? albumByKey.get(titleKey(album))?.year : undefined,
      durationSec: t.duration || undefined,
      rank: songs.length + 1,
      streams,
      previewUrl: t.preview,
      links: { deezer: t.link },
    });
    if (songs.length >= max) break;
  }
  return songs;
}

/** Straight double quotes around a phrase → typographic quotes (the wording is untouched). */
export function curlyQuotes(text: string): string {
  return text.replace(/"([^"\n]{1,200})"/g, "“$1”");
}

/** Zero-width characters copied along with web text (Wikipedia uses U+200B in places). */
export function stripInvisible(text: string): string {
  return text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");
}

function dedupeParagraphs(paragraphs: string[]): string[] {
  const out: string[] = [];
  const keys: string[] = [];
  for (const p of paragraphs) {
    const clean = curlyQuotes(stripInvisible(p).replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim());
    if (clean.length < 80) continue;
    const key = normalizeText(clean).slice(0, 160);
    if (keys.some((k) => k.includes(key.slice(0, 80)) || key.includes(k.slice(0, 80)))) continue;
    keys.push(key);
    out.push(clean);
  }
  return out;
}

const BioSchema = z.object({
  summary: z.string().describe("1–2 sentence summary"),
  paragraphs: z.array(z.string()).describe("3–6 biography paragraphs"),
});

/** Drop sentences containing years/numbers that appear in no source document. */
export function groundingFilter(paragraphs: string[], docs: SourceDoc[]): string[] {
  const corpus = normalizeText(docs.map((d) => d.text).join(" "));
  return paragraphs
    .map((p) =>
      splitSentences(p)
        .filter((s) => (s.match(/\b\d[\d.,]*\b/g) ?? []).every((n) => corpus.includes(n.replace(/[.,]$/, ""))))
        .join(" "),
    )
    .filter((p) => p.length >= 80);
}

async function buildBiography(
  b: RawSourceBundle,
  lang: Lang,
  name: string,
  facts: Fact[],
  debutYear: number | undefined,
  ctx: FactoryContext,
  log: Logger,
  llmStructured: typeof generateStructured | undefined,
): Promise<{ bio: Omit<Biography, "facts" | "genres" | "labels" | "image">; llmUsed: boolean; sources: string[] }> {
  const wikiLang = b.wikipedia[lang];
  const wikiOther = b.wikipedia[lang === "es" ? "en" : "es"];
  const official = lang === "es" ? (b.official?.bioParagraphs ?? []) : [];
  // config/artist.json → extraSources: for an artist with no official site or Wikipedia page, these
  // (a press article, an about page) may be the only real biography material available.
  const extraDocs = b.docs.filter((d) => d.sourceId.startsWith("extra-"));
  const extra = extraDocs.flatMap((d) => paragraphsFromText(d.text));
  const usedSources: string[] = [];
  let paragraphs = dedupeParagraphs([...official, ...extra, ...(wikiLang?.paragraphs ?? [])]);
  if (official.length) usedSources.push(L[lang].officialSite);
  if (extraDocs.length) usedSources.push(...extraDocs.map((d) => d.name));
  if (wikiLang?.paragraphs.length) usedSources.push(`${L[lang].wikipedia} (${lang})`);
  if (paragraphs.length < 2 && wikiOther?.paragraphs.length) {
    paragraphs = dedupeParagraphs([...paragraphs, ...wikiOther.paragraphs]);
    usedSources.push(`${L[lang].wikipedia} (${wikiOther.lang})`);
  }
  paragraphs = paragraphs.slice(0, 6);
  let summary = curlyQuotes(stripInvisible(wikiLang?.summary ? splitSentences(wikiLang.summary).slice(0, 2).join(" ") : splitSentences(paragraphs[0] ?? "").slice(0, 2).join(" ")));
  if (summary.length > 320) summary = splitSentences(summary)[0] ?? summary.slice(0, 320);

  const useLLM = resolveAutoMode(ctx.config.tools.contentFetch.useLLM, llmAvailable()) && (llmStructured !== undefined || llmAvailable());
  let llmUsed = false;
  if (useLLM && paragraphs.length) {
    const generate = llmStructured ?? generateStructured;
    const sourceDocs = b.docs.filter((d) => ["official-bio", "wikipedia-es", "wikipedia-en", "wikidata", "musicbrainz"].includes(d.sourceId));
    const sourceText = sourceDocs.map((d) => `### ${d.name} (${d.url})\n${d.text.slice(0, 9000)}`).join("\n\n");
    try {
      const out = await generate({
        label: "content:biography",
        logger: log,
        model: ctx.config.tools.contentFetch.llmModel,
        effort: "medium",
        schema: BioSchema,
        system:
          "You write the biography section of an artist's website. Use ONLY facts stated in the provided sources — never add facts, numbers, dates, awards or quotes that are not in them. Write warm, polished prose for fans.",
        prompt: `Write the biography of ${name} in ${lang === "es" ? "Spanish (Mexico)" : "English"}: a 1–2 sentence summary and 3–6 paragraphs (each 60–140 words), chronological, no lists, no song lyrics, no headings.${debutYear ? ` Her recording debut was in ${debutYear}.` : ""}\nKnown facts: ${facts.map((f) => `${f.label}: ${f.value}`).join("; ")}\n\nSOURCES:\n${sourceText}`,
      });
      const grounded = groundingFilter(out.paragraphs, b.docs);
      if (grounded.length >= 2) {
        paragraphs = grounded.slice(0, 6);
        if (groundingFilter([out.summary], b.docs).length) summary = out.summary;
        llmUsed = true;
        log.info(`Biography polished by the LLM (${grounded.length} grounded paragraphs)`);
      } else {
        log.warn("LLM biography failed the grounding check — using source paragraphs");
      }
    } catch (err) {
      log.warn(`LLM biography unavailable (${describeLLMError(err)}) — using source paragraphs`);
    }
  }

  const sources: LinkItem[] = [];
  if (official.length && b.official?.bioUrl) sources.push({ label: lang === "es" ? "Sitio oficial — Biografía" : "Official website — Biography", href: b.official.bioUrl, external: true });
  for (const d of extraDocs) sources.push({ label: d.name, href: d.url, external: true });
  if (wikiLang) sources.push({ label: `Wikipedia (${lang})`, href: wikiLang.url, external: true });
  if (usedSources.some((s) => s.includes(`(${wikiOther?.lang})`)) && wikiOther) sources.push({ label: `Wikipedia (${wikiOther.lang})`, href: wikiOther.url, external: true });
  return {
    bio: {
      summary,
      paragraphs,
      birthDate: undefined,
      sourceNote: usedSources.length ? L[lang].bioNote(usedSources) : undefined,
      sources,
    },
    llmUsed,
    sources: usedSources,
  };
}

const QUOTE_KEYWORDS = /\b(voz|voice|exito|éxito|hits?|record|récord|billboard|primer lugar|top 10|generaciones|generations|dama de hierro|iron lady|millones|million|premio|award|icono|ícono|icon|leyenda|legend|inconfundible|autentic|auténtic|consentida|popularidad|debut)/i;

/**
 * Verbatim quotable sentences from the sources. Sentences the biography already shows are skipped
 * (the page would repeat itself), and quotes in the site language come first: other-language
 * quotes are used only when fewer than two same-language quotes exist.
 */
function buildQuotes(b: RawSourceBundle, lang: Lang, max: number, shownText: string[]): Quote[] {
  const preferred = lang === "es" ? ["official-bio", "wikipedia-es", "wikipedia-en"] : ["wikipedia-en", "official-bio", "wikipedia-es"];
  const shown = normalizeText(shownText.join(" "));
  const candidates: Array<Quote & { score: number; sameLang: boolean }> = [];
  for (const doc of b.docs) {
    if (!preferred.includes(doc.sourceId) && !doc.sourceId.startsWith("extra-")) continue;
    const text = stripInvisible(doc.text).replace(/==+[^=]+==+/g, " ").replace(/\[\d+\]/g, "");
    for (const raw of splitSentences(text)) {
      const sentence = curlyQuotes(raw);
      if (sentence.length < 70 || sentence.length > 280 || !/^[A-ZÁÉÍÓÚÑ"“¿¡]/.test(sentence) || !/[.!?]$/.test(sentence)) continue;
      if (shown.includes(normalizeText(sentence).slice(0, 80))) continue;
      const kw = sentence.match(new RegExp(QUOTE_KEYWORDS, "gi"))?.length ?? 0;
      if (!kw) continue;
      candidates.push({
        id: "",
        quote: sentence,
        outlet: doc.name,
        url: doc.url,
        sameLang: !doc.lang || doc.lang === lang,
        score: kw * 2 + (preferred.indexOf(doc.sourceId) === 0 ? 1 : 0) - (sentence.length > 220 ? 1 : 0),
      });
    }
  }
  candidates.sort((a, b2) => b2.score - a.score);
  const perSource = new Map<string, number>();
  const out: Quote[] = [];
  const take = (pool: typeof candidates) => {
    for (const c of pool) {
      if (out.length >= max) return;
      const used = perSource.get(c.outlet) ?? 0;
      if (used >= 2 || out.some((q) => normalizeText(q.quote) === normalizeText(c.quote))) continue;
      perSource.set(c.outlet, used + 1);
      out.push({ id: `quote-${out.length + 1}`, quote: c.quote, outlet: c.outlet, url: c.url });
    }
  };
  take(candidates.filter((c) => c.sameLang));
  if (out.length < 2) take(candidates.filter((c) => !c.sameLang));
  return out;
}

function handleOf(platform: SocialPlatform, href: string): string | undefined {
  try {
    const u = new URL(href);
    const seg = u.pathname.split("/").filter(Boolean)[0];
    if (!seg) return undefined;
    if (["instagram", "x", "tiktok"].includes(platform)) return seg.startsWith("@") ? seg : `@${seg}`;
  } catch {
    return undefined;
  }
  return undefined;
}

function buildSocialLinks(b: RawSourceBundle, spotifyId: string | undefined, knownSocialLinks: string[]): SocialLink[] {
  const byPlatform = new Map<SocialPlatform, string>();
  const offer = (platform: SocialPlatform | null, href: string | undefined) => {
    if (!platform || !href || byPlatform.has(platform)) return;
    byPlatform.set(platform, href.replace(/^http:/, "https:"));
  };
  if (spotifyId) offer("spotify", `https://open.spotify.com/artist/${spotifyId}`);
  if (b.itunes?.artistUrl) offer("apple-music", b.itunes.artistUrl);
  if (b.deezer?.artist.link) offer("deezer", b.deezer.artist.link);
  for (const s of b.official?.socials ?? []) offer(s.platform, s.href);
  for (const s of b.wikidata?.socials ?? []) offer(s.platform, s.href);
  for (const u of b.musicbrainz?.urls ?? []) offer(platformFromUrl(u.url), u.url);
  // config/artist.json → knownSocialLinks: for an artist too small for Wikidata/MusicBrainz url-rels,
  // a handle cited by a real source (e.g. a press article) and turned into its profile URL.
  for (const url of knownSocialLinks) offer(platformFromUrl(url), url);
  const site = b.official?.url ?? b.resolved.officialSite;
  if (site) offer("website", site);
  const order: SocialPlatform[] = ["spotify", "apple-music", "deezer", "youtube", "amazon-music", "soundcloud", "instagram", "tiktok", "facebook", "x", "website", "other"];
  return order
    .filter((p) => byPlatform.has(p))
    .map((platform) => {
      const href = byPlatform.get(platform)!;
      return { platform, label: PLATFORM_LABEL[platform], href, handle: handleOf(platform, href) };
    });
}

async function downloadAlbumCovers(ctx: FactoryContext, drafts: AlbumDraft[], lang: Lang, log: Logger, enabled: boolean): Promise<Album[]> {
  const coversDir = path.join(ctx.paths.contentDir, "images", "covers");
  const out: Album[] = [];
  let downloaded = 0;
  for (const d of drafts) {
    const { coverUrl, ...album } = d;
    if (enabled && coverUrl && downloaded < 30) {
      const file = path.join(coversDir, `${d.id}.jpg`);
      try {
        const size = await downloadImage(coverUrl, file);
        if (size) {
          downloaded++;
          album.cover = {
            src: `/images/covers/${d.id}.jpg`,
            alt: L[lang].coverAlt(d.title, d.year),
            width: size.width,
            height: size.height,
            credit: L[lang].coversCredit,
            sourceUrl: d.links.appleMusic ?? d.links.deezer,
            localFile: toPosixRelative(ctx.paths.root, file),
          };
        }
      } catch (err) {
        log.debug(`[content] cover download failed for ${d.title}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    out.push(album);
  }
  return out;
}

// Function words that occur in only one of the two languages ("la"/"de" are left out: they also
// appear in Spanish names and nicknames quoted inside English text).
const ONLY_EN = /\b(the|of|and|is|are|with|as|by|from|for|during|her|his|singer|performing)\b/gi;
const ONLY_ES = /\b(el|los|las|del|y|en|con|por|para|durante|su|cantante|actuando)\b/gi;

/** A Commons description usable as alt text on a site in `lang`: short, unquoted, same language. */
export function altInLanguage(description: string | undefined, lang: Lang): string | undefined {
  const text = description?.replace(/^[\s"“”'‘’«»]+|[\s"“”'‘’«»]+$/g, "").trim();
  if (!text || text.length >= 140) return undefined;
  const en = text.match(ONLY_EN)?.length ?? 0;
  const es = text.match(ONLY_ES)?.length ?? 0;
  return (lang === "es" ? en > es : es > en) ? undefined : text;
}

/** The artist's profile picture on Deezer (a press photo), used when Commons has fewer than two photos. */
async function downloadProfilePicture(ctx: FactoryContext, b: RawSourceBundle, name: string, lang: Lang, log: Logger, enabled: boolean): Promise<ImageAsset | undefined> {
  const url = b.deezer?.artist.picture;
  if (!enabled || !url) return undefined;
  const file = path.join(ctx.paths.contentDir, "images", "profile-deezer.jpg");
  try {
    const size = await downloadImage(url, file);
    if (!size) return undefined;
    return {
      src: "/images/profile-deezer.jpg",
      alt: L[lang].photoAlt(name),
      width: size.width,
      height: size.height,
      credit: "Deezer",
      sourceUrl: b.deezer?.artist.link,
      localFile: toPosixRelative(ctx.paths.root, file),
    };
  } catch (err) {
    log.debug(`[content] profile picture download failed: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

async function downloadPhotos(ctx: FactoryContext, b: RawSourceBundle, name: string, lang: Lang, log: Logger, enabled: boolean): Promise<ImageAsset[]> {
  if (!enabled) return [];
  const dir = path.join(ctx.paths.contentDir, "images", "gallery");
  const out: ImageAsset[] = [];
  for (const [i, img] of b.commons.entries()) {
    const ext = path.extname(new URL(img.thumbUrl).pathname).toLowerCase() || ".jpg";
    const file = path.join(dir, `${String(i + 1).padStart(2, "0")}-${slugify(img.file.replace(/\.[a-z]+$/i, ""), 40)}${ext === ".png" ? ".png" : ".jpg"}`);
    try {
      const size = await downloadImage(img.thumbUrl, file);
      if (!size) continue;
      out.push({
        src: `/images/gallery/${path.basename(file)}`,
        alt: altInLanguage(img.description, lang) ?? L[lang].photoAlt(name),
        width: size.width,
        height: size.height,
        credit: img.author,
        license: img.license,
        sourceUrl: img.descriptionUrl,
        localFile: toPosixRelative(ctx.paths.root, file),
      });
    } catch (err) {
      log.debug(`[content] photo download failed for ${img.file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

function formatDate(iso: string, locale: string): string {
  if (/^\d{4}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12)));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function synthesizeContent(
  run: PipelineRun,
  opts: { llmStructured?: typeof generateStructured; bundle?: RawSourceBundle } = {},
): Promise<{ file: string; document: ContentDocument }> {
  const { ctx, checkpoint } = run;
  const log = run.logger.child("content");
  const file = contentFile(ctx);
  if (checkpoint.isItemDone(PHASE, "content") && (await fs.pathExists(file))) {
    log.info("Artist content already synthesized — skipping");
    return { file, document: await loadContent(ctx) };
  }
  await checkpoint.setItem(PHASE, "content", "running");
  const lang: Lang = ctx.config.siteLanguage;
  const locale = ctx.config.locale;
  const cfg = ctx.config.tools.contentFetch;
  const artist = ctx.artist;
  log.info(`Phase 5: Fetching public information about "${artist.searchName}"`);

  const b = opts.bundle ?? (await fetchAllSources(ctx, log));
  const warnings = [...b.warnings];
  const wd = b.wikidata;

  // Identity
  const sourceName = wd?.label[lang] ?? wd?.label.es ?? wd?.label.en ?? b.musicbrainz?.name;
  const name = artist.displayNameOverride ?? sourceName ?? artist.searchName;
  if (artist.requestedDisplayName && normalizeText(artist.requestedDisplayName) !== normalizeText(name)) {
    const corroborated = b.docs.some((d) => normalizeText(d.text).includes(normalizeText(artist.requestedDisplayName!)));
    if (!corroborated) {
      const msg = `Requested display name "${artist.requestedDisplayName}" was not found in any source; the sites use "${name}" (set displayNameOverride in config/artist.json to force a name).`;
      log.warn(msg);
      warnings.push(msg);
    }
  }
  const legalName = wd?.birthName ?? wd?.aliases.find((a) => normalizeText(a).startsWith(normalizeText(name)) && a.trim().split(/\s+/).length >= 2 && normalizeText(a) !== normalizeText(name));

  // Claims
  const claims = verifyClaims(artist.claimsToVerify, b.docs, {
    birthDate: wd?.birthDate ?? b.musicbrainz?.beginDate,
    birthPlace: wd?.birthPlace ?? b.musicbrainz?.beginArea,
    legalNames: [legalName, wd?.birthName].filter((x): x is string => Boolean(x)),
  });
  const verified = (id: string) => claims.find((c) => c.id === id && c.status === "verified");
  const claimDisplays = artist.claimsToVerify.filter((c) => verified(c.id) && c.display).map((c) => c.display!);
  for (const c of claims) log.info(`Claim ${c.status.toUpperCase().padEnd(12)} ${c.claim}`);

  // Aliases & discography
  const aliases = [...new Set([...claimDisplays.map((d) => d.alias).filter((a): a is string => Boolean(a)), ...(wd?.nicknames ?? [])])].filter(
    (a) => normalizeText(a) !== normalizeText(name),
  );
  const drafts = buildDiscography(b);
  const discography = await downloadAlbumCovers(ctx, drafts, lang, log, cfg.downloadImages);
  const debut = discography.find((a) => a.highlight) ?? discography.find((a) => a.year);
  const debutYear = debut?.year ?? yearOf(wd?.birthDate ? undefined : undefined);
  const topSongs = buildTopSongs(b, discography, locale, cfg.maxTopSongs);

  // Facts
  const T = L[lang];
  const facts: Fact[] = [];
  facts.push({ label: T.facts.stageName, value: name });
  if (legalName) facts.push({ label: T.facts.birthName, value: legalName });
  const birthDate = wd?.birthDate ?? (b.musicbrainz?.beginDate && /^\d{4}-\d{2}-\d{2}$/.test(b.musicbrainz.beginDate) ? b.musicbrainz.beginDate : undefined);
  if (birthDate) facts.push({ label: T.facts.born, value: formatDate(birthDate, locale) });
  const birthPlace = wd?.birthPlace ?? b.musicbrainz?.beginArea;
  if (birthPlace) facts.push({ label: T.facts.birthPlace, value: birthPlace });
  if (debut?.year) facts.push({ label: T.facts.debut, value: `${debut.title} (${debut.year})` });
  if (aliases[0]) facts.push({ label: T.facts.alias, value: aliases[0] });
  if (wd?.genres.length) facts.push({ label: T.facts.genres, value: wd.genres.slice(0, 4).join(", ") });
  if (debutYear) facts.push({ label: T.facts.active, value: `${debutYear}–${T.present}` });
  if (wd?.recordLabels.length) facts.push({ label: T.facts.labels, value: wd.recordLabels.slice(0, 3).join(", ") });

  // Biography
  const { bio, llmUsed } = await buildBiography(b, lang, name, facts, debutYear, ctx, log, opts.llmStructured);
  if (!bio.paragraphs.length) warnings.push("No biography text could be fetched.");

  // Images
  // Hero and biography portrait are different pictures whenever possible: a second Commons photo,
  // else the Deezer profile picture; one photo is never shown twice.
  const photos = await downloadPhotos(ctx, b, name, lang, log, cfg.downloadImages);
  const profile = photos.length < 2 ? await downloadProfilePicture(ctx, b, name, lang, log, cfg.downloadImages) : undefined;
  const hero = photos[0] ?? profile;
  const portrait = photos.find((p) => p !== hero && p.height > p.width) ?? photos.find((p) => p !== hero) ?? (profile !== hero ? profile : undefined);

  // Stats
  const studioAlbums = discography.filter((a) => a.type === "album").length;
  const yearsActive = debutYear ? new Date().getFullYear() - debutYear : undefined;
  const items: Stat[] = [];
  if (studioAlbums) items.push({ id: "stat-albums", label: T.stats.albums, value: String(studioAlbums), sourceUrl: b.musicbrainz?.url });
  if (yearsActive && yearsActive > 0) items.push({ id: "stat-years", label: T.stats.years, value: String(yearsActive), detail: `${T.since} ${debutYear}` });
  if (b.spotify?.monthlyListeners) items.push({ id: "stat-listeners", label: T.stats.listeners, value: b.spotify.monthlyListeners, sourceUrl: b.spotify.url });
  for (const [i, d] of claimDisplays.entries()) {
    if (d.stat) items.push({ id: `stat-claim-${i + 1}`, label: d.stat[lang].label, value: d.stat[lang].value });
  }
  if (b.deezer?.artist.nbFan) items.push({ id: "stat-deezer", label: T.stats.deezer, value: compactNumber(b.deezer.artist.nbFan, locale), sourceUrl: b.deezer.artist.link });
  if (items.length < 3 && discography.length) items.push({ id: "stat-releases", label: T.stats.releases, value: String(discography.length) });

  // Tagline
  const taglineParts = [aliases[0], claimDisplays.find((d) => d.tagline)?.tagline?.[lang] ?? (debutYear ? `${T.since} ${debutYear}` : undefined)].filter(Boolean);
  const tagline = taglineParts.join(" — ") || (wd?.description[lang] ?? name);

  // Videos, socials, contact, tour, news
  const videos: Video[] = b.videos.map((v) => ({ id: `video-${v.youtubeId}`, title: v.title, youtubeId: v.youtubeId, publishedAt: v.publishedAt }));
  const spotifyArtistId = b.resolved.spotifyArtistId;
  const socialLinks = buildSocialLinks(b, spotifyArtistId, artist.knownSocialLinks);
  const tourDates: TourEvent[] = [...b.tourEvents]
    .sort((a, c) => a.date.localeCompare(c.date))
    .filter((e, i, arr) => arr.findIndex((x) => x.date === e.date && normalizeText(x.venue) === normalizeText(e.venue)) === i)
    .map((e) => ({
      id: `event-${e.date}-${slugify(e.venue, 30)}`,
      date: e.date,
      time: e.time,
      venue: e.venue,
      city: e.city,
      region: e.region,
      country: e.country,
      ticketUrl: e.ticketUrl,
      status: e.status,
      tourName: e.tourName,
    }));
  const tourNames = tourDates.map((e) => e.tourName).filter(Boolean) as string[];
  const tourName = tourNames.length && tourNames.every((n) => n === tourNames[0]) ? tourNames[0] : undefined;
  const news: NewsItem[] = (b.official?.news ?? []).map((n, i) => ({ id: `news-${i + 1}`, title: n.title, href: n.href, date: n.date }));
  const pressQuotes = buildQuotes(b, lang, cfg.maxPressQuotes, [bio.summary, ...bio.paragraphs]);

  // Credits & provenance
  const used = new Set<string>();
  const creditSources: LinkItem[] = [];
  for (const s of b.sources) {
    if (used.has(s.url)) continue;
    used.add(s.url);
    creditSources.push({ label: s.name, href: s.url, external: true });
  }
  const imageCredits = [
    ...photos.map((p) => `${T.photo}: ${p.credit ?? "Wikimedia Commons"}${p.license ? ` (${p.license})` : ""}, Wikimedia Commons`),
    ...(profile && (hero === profile || portrait === profile) ? [T.profileCredit] : []),
    ...(discography.some((a) => a.cover) ? [T.coversCredit] : []),
  ];
  const fieldSources: Record<string, string[]> = {
    "/name": [artist.displayNameOverride ? "config" : wd ? "wikidata" : "config"],
    "/biography/paragraphs": [...new Set(b.docs.filter((d) => ["official-bio", `wikipedia-${lang}`].includes(d.sourceId)).map((d) => d.sourceId))],
    "/biography/facts": ["wikidata", "musicbrainz"],
    "/discography": ["musicbrainz", "itunes", "deezer"].filter((s) => b.providers.some((p) => p.id === s && p.status !== "failed")),
    "/topSongs": ["deezer", ...(b.spotify ? ["spotify"] : [])],
    "/tourDates": [...new Set(b.tourEvents.map((e) => e.source))],
    "/videos": ["official-site", "youtube"],
    "/images": ["commons"],
    "/socialLinks": ["official-site", "wikidata", "musicbrainz", "deezer", "itunes"],
    "/pressQuotes": [...new Set(pressQuotes.map((q) => b.sources.find((s) => s.name === q.outlet)?.id ?? q.outlet))],
    "/stats": ["musicbrainz", "deezer", ...(b.spotify ? ["spotify"] : []), ...claims.filter((c) => c.status === "verified").map((c) => `claim:${c.id}`)],
  };

  const content: ArtistContent = {
    name,
    legalName,
    aliases,
    tagline,
    shortBio: bio.summary || `${name}.`,
    lang,
    locale,
    biography: {
      ...bio,
      facts,
      birthDate,
      birthPlace,
      origin: birthPlace,
      genres: wd?.genres ?? [],
      yearsActive: debutYear ? `${debutYear}–${T.present}` : undefined,
      debutYear,
      labels: wd?.recordLabels ?? [],
      image: portrait,
    },
    discography,
    topSongs,
    tourDates,
    tour: { name: tourName, ticketsUrl: b.official?.ticketsUrl ?? tourDates.find((e) => e.ticketUrl)?.ticketUrl },
    videos,
    images: { hero, portrait, gallery: photos },
    socialLinks,
    pressQuotes,
    stats: {
      monthlyListeners: b.spotify?.monthlyListeners,
      totalStreams: claimDisplays.find((d) => d.stat && /stream|reproduc/i.test(d.stat.en.label))?.stat?.[lang].value,
      albumsSold: claimDisplays.find((d) => d.tagline)?.stat?.[lang].value,
      discographyCount: studioAlbums,
      deezerFans: b.deezer?.artist.nbFan ? compactNumber(b.deezer.artist.nbFan, locale) : undefined,
      yearsActive: yearsActive ? String(yearsActive) : undefined,
      items,
    },
    news,
    contact: { bookingEmail: b.official?.emails[0], bookingUrl: b.official?.contactUrl },
    spotifyArtistId,
    officialSite: b.official?.url ?? b.resolved.officialSite,
    credits: { sources: creditSources, imageCredits, generatedAt: isoTimestamp() },
  };

  const document = ContentDocumentSchema.parse({
    ...content,
    meta: {
      schemaVersion: 1,
      artistSlug: artist.slug,
      generatedAt: isoTimestamp(),
      requestedDisplayName: artist.requestedDisplayName ?? undefined,
      sources: b.sources,
      fieldSources,
      claims,
      providers: b.providers,
      llmUsed,
      warnings,
    },
  });
  await writeJson(file, document);
  log.success(
    `Content synthesized for "${name}": ${discography.length} releases (${discography.filter((a) => a.cover).length} covers), ${topSongs.length} songs, ${videos.length} videos, ${photos.length} photos, ${pressQuotes.length} quotes, ${tourDates.length} tour dates, ${claims.filter((c) => c.status === "verified").length}/${claims.length} claims verified`,
  );
  await checkpoint.setItem(PHASE, "content", warnings.length > 5 ? "degraded" : "completed");
  return { file, document };
}
