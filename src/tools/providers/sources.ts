import * as cheerio from "cheerio";
import { chromium } from "playwright";
import type { ProviderRun, SocialPlatform, SourceRef } from "../../schemas/content-schema.js";
import type { Logger } from "../../utils/logger.js";
import { isoTimestamp } from "../../utils/logger.js";
import { createRateLimiter, fetchJson, fetchText, normalizeText, paragraphsFromText, titleKey } from "./web.js";

/**
 * Public-data providers for the content synthesizer. Each provider is independent, time-boxed and
 * returns typed data plus the plain-text documents (SourceDoc) used later for claim verification.
 * No API keys are required except for the optional Ticketmaster / Bandsintown tour lookups.
 */

export interface SourceDoc {
  sourceId: string;
  name: string;
  url: string;
  lang?: "es" | "en";
  text: string;
  license?: string;
}

export interface ProviderOutput<T> {
  data?: T;
  docs: SourceDoc[];
  sources: SourceRef[];
  run: ProviderRun;
  warnings: string[];
}

/** Run a provider body with timing and error capture. */
export async function provider<T>(
  id: string,
  log: Logger,
  body: (out: { docs: SourceDoc[]; sources: SourceRef[]; warnings: string[] }) => Promise<T | undefined>,
): Promise<ProviderOutput<T>> {
  const started = Date.now();
  const acc = { docs: [] as SourceDoc[], sources: [] as SourceRef[], warnings: [] as string[] };
  try {
    const data = await body(acc);
    const status = data === undefined ? "skipped" : acc.warnings.length ? "partial" : "ok";
    log.debug(`[content:${id}] ${status} in ${Date.now() - started}ms`);
    return { data, ...acc, run: { id, status, durationMs: Date.now() - started, detail: acc.warnings.join("; ") || undefined } };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log.warn(`Content source "${id}" failed: ${detail}`);
    return { ...acc, run: { id, status: "failed", durationMs: Date.now() - started, detail } };
  }
}

const ref = (id: string, name: string, url: string, license?: string): SourceRef => ({ id, name, url, retrievedAt: isoTimestamp(), license });

export function platformFromUrl(href: string): SocialPlatform | null {
  let host: string;
  try {
    host = new URL(href).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)(facebook|fb)\.com$/.test(host)) return "facebook";
  if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
  if (/(^|\.)(twitter|x)\.com$/.test(host)) return "x";
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host) && !/music\.youtube/.test(host)) return "youtube";
  if (/spotify\.com$/.test(host)) return "spotify";
  if (/music\.apple\.com$|itunes\.apple\.com$/.test(host)) return "apple-music";
  if (/deezer\.com$/.test(host)) return "deezer";
  if (/soundcloud\.com$/.test(host)) return "soundcloud";
  if (/music\.amazon\./.test(host)) return "amazon-music";
  return null;
}

// ---------------------------------------------------------------------------
// Wikidata
// ---------------------------------------------------------------------------

export interface WikidataInfo {
  id: string;
  url: string;
  label: { es?: string; en?: string };
  description: { es?: string; en?: string };
  aliases: string[];
  birthName?: string;
  nicknames: string[];
  birthDate?: string;
  birthPlace?: string;
  genres: string[];
  recordLabels: string[];
  commonsImage?: string;
  ids: { musicbrainz?: string; spotify?: string; deezer?: string; appleMusic?: string; youtubeChannel?: string };
  socials: Array<{ platform: SocialPlatform; href: string }>;
  officialSite?: string;
  sitelinks: { es?: string; en?: string };
}

type WdEntity = {
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  aliases?: Record<string, Array<{ value: string }>>;
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>;
  sitelinks?: Record<string, { title: string }>;
};

function claimValues(entity: WdEntity, prop: string): unknown[] {
  return (entity.claims?.[prop] ?? []).map((c) => c.mainsnak?.datavalue?.value).filter((v) => v !== undefined && v !== null);
}

const claimString = (entity: WdEntity, prop: string): string | undefined => {
  const v = claimValues(entity, prop)[0];
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "text" in v) return String((v as { text: string }).text);
  return undefined;
};

const claimIds = (entity: WdEntity, prop: string): string[] =>
  claimValues(entity, prop)
    .map((v) => (v && typeof v === "object" && "id" in v ? String((v as { id: string }).id) : null))
    .filter((v): v is string => Boolean(v));

export async function searchWikidata(name: string, timeoutMs: number): Promise<string | null> {
  const data = await fetchJson<{ search?: Array<{ id: string; label?: string; description?: string }> }>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=es&uselang=es&type=item&limit=10&format=json`,
    { timeoutMs },
  );
  const target = normalizeText(name);
  // Same person, not just a related or same-first-name entity: Wikidata's search ranks by relevance, not
  // identity, and a same-first-name homonym (e.g. a search for "Marisela Beltrán" surfacing the better-known
  // "Marisela") would misattribute a real person's biography, photos and discography to someone else.
  const named = (data.search ?? []).filter((s) => normalizeText(s.label ?? "") === target);
  const hit = named.find((s) => /cantante|singer|músic|music|actriz/i.test(s.description ?? "")) ?? named[0];
  return hit?.id ?? null;
}

export function fetchWikidata(id: string, log: Logger, timeoutMs: number): Promise<ProviderOutput<WikidataInfo>> {
  return provider("wikidata", log, async (out) => {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${id}.json`;
    const data = await fetchJson<{ entities: Record<string, WdEntity> }>(url, { timeoutMs });
    const entity = data.entities[id] ?? Object.values(data.entities)[0];
    if (!entity) throw new Error(`entity ${id} not found`);
    const refIds = [...claimIds(entity, "P19"), ...claimIds(entity, "P136"), ...claimIds(entity, "P264")];
    const labels: Record<string, string> = {};
    if (refIds.length) {
      const lab = await fetchJson<{ entities: Record<string, WdEntity> }>(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${refIds.slice(0, 45).join("|")}&props=labels&languages=es|en&format=json`,
        { timeoutMs },
      );
      for (const [qid, e] of Object.entries(lab.entities ?? {})) labels[qid] = e.labels?.es?.value ?? e.labels?.en?.value ?? qid;
    }
    const time = claimValues(entity, "P569")[0] as { time?: string; precision?: number } | undefined;
    let birthDate: string | undefined;
    if (time?.time) {
      const m = time.time.match(/^[+-](\d{4})-(\d{2})-(\d{2})/);
      if (m) birthDate = time.precision && time.precision >= 11 ? `${m[1]}-${m[2]}-${m[3]}` : m[1];
    }
    const socials: Array<{ platform: SocialPlatform; href: string }> = [];
    const ig = claimString(entity, "P2003");
    if (ig) socials.push({ platform: "instagram", href: `https://www.instagram.com/${ig}/` });
    const fb = claimString(entity, "P2013");
    if (fb) socials.push({ platform: "facebook", href: `https://www.facebook.com/${fb}` });
    const x = claimString(entity, "P2002");
    if (x) socials.push({ platform: "x", href: `https://x.com/${x}` });
    const tt = claimString(entity, "P7085");
    if (tt) socials.push({ platform: "tiktok", href: `https://www.tiktok.com/@${tt}` });
    const yt = claimString(entity, "P2397");
    if (yt) socials.push({ platform: "youtube", href: `https://www.youtube.com/channel/${yt}` });
    const info: WikidataInfo = {
      id,
      url: `https://www.wikidata.org/wiki/${id}`,
      label: { es: entity.labels?.es?.value, en: entity.labels?.en?.value },
      description: { es: entity.descriptions?.es?.value, en: entity.descriptions?.en?.value },
      aliases: [...(entity.aliases?.es ?? []), ...(entity.aliases?.en ?? [])].map((a) => a.value),
      birthName: claimString(entity, "P1477"),
      nicknames: claimValues(entity, "P1449").map((v) => (v && typeof v === "object" && "text" in v ? String((v as { text: string }).text) : "")).filter(Boolean),
      birthDate,
      birthPlace: claimIds(entity, "P19").map((q) => labels[q]).find(Boolean),
      genres: claimIds(entity, "P136").map((q) => labels[q]).filter(Boolean),
      recordLabels: claimIds(entity, "P264").map((q) => labels[q]).filter(Boolean),
      commonsImage: claimString(entity, "P18"),
      ids: {
        musicbrainz: claimString(entity, "P434"),
        spotify: claimString(entity, "P1902"),
        deezer: claimString(entity, "P2722"),
        appleMusic: claimString(entity, "P2850"),
        youtubeChannel: yt,
      },
      socials,
      officialSite: claimString(entity, "P856"),
      sitelinks: { es: entity.sitelinks?.eswiki?.title, en: entity.sitelinks?.enwiki?.title },
    };
    out.sources.push(ref("wikidata", "Wikidata", info.url, "CC0"));
    const facts = [
      info.label.es && `Nombre: ${info.label.es}`,
      info.aliases.length && `Alias: ${info.aliases.join(", ")}`,
      info.birthName && `Nombre de nacimiento: ${info.birthName}`,
      info.birthDate && `Fecha de nacimiento: ${info.birthDate}`,
      info.birthPlace && `Lugar de nacimiento: ${info.birthPlace}`,
      info.description.es,
      info.description.en,
    ].filter(Boolean);
    out.docs.push({ sourceId: "wikidata", name: "Wikidata", url: info.url, text: facts.join(". "), license: "CC0" });
    return info;
  });
}

// ---------------------------------------------------------------------------
// Wikipedia
// ---------------------------------------------------------------------------

export interface WikiPage {
  lang: "es" | "en";
  title: string;
  url: string;
  summary: string;
  extract: string;
  /** Biography-relevant paragraphs (intro + career/life sections). */
  paragraphs: string[];
  imageFiles: string[];
}

const BIO_SECTION = /biograf|carrera|vida|trayectoria|inicios|primeros|career|life|early|biography|historia|personal/i;
const SKIP_SECTION = /discograf|filmograf|referencias|enlaces|véase|ver también|premios|notas|bibliograf|discography|filmography|references|external|see also|awards|notes|telenovelas|televisión|giras|tours/i;

export function fetchWikipedia(lang: "es" | "en", title: string, log: Logger, timeoutMs: number): Promise<ProviderOutput<WikiPage>> {
  return provider(`wikipedia-${lang}`, log, async (out) => {
    const base = `https://${lang}.wikipedia.org`;
    const summary = await fetchJson<{ extract?: string; content_urls?: { desktop?: { page?: string } }; title?: string }>(
      `${base}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      { timeoutMs },
    );
    const full = await fetchJson<{ query?: { pages?: Record<string, { title?: string; extract?: string; images?: Array<{ title: string }> }> } }>(
      `${base}/w/api.php?action=query&prop=extracts|images&explaintext=1&imlimit=50&redirects=1&format=json&titles=${encodeURIComponent(title)}`,
      { timeoutMs },
    );
    const page = Object.values(full.query?.pages ?? {})[0];
    const extract = page?.extract ?? "";
    const url = summary.content_urls?.desktop?.page ?? `${base}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    // Walk sections: intro + biography-like sections, skipping lists.
    const paragraphs: string[] = [];
    let section = "";
    for (const rawLine of extract.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const heading = line.match(/^=+\s*(.+?)\s*=+$/);
      if (heading) {
        section = heading[1];
        continue;
      }
      const inBio = !section || (BIO_SECTION.test(section) && !SKIP_SECTION.test(section));
      if (inBio && line.length >= 120 && /[.!?»”)]$/.test(line)) paragraphs.push(line);
    }
    const imageFiles = (page?.images ?? [])
      .map((i) => i.title)
      .filter((t) => /\.(jpe?g|png)$/i.test(t) && !/logo|icon|flag|bandera|escudo|commons-logo|wiki/i.test(t))
      .map((t) => t.replace(/^(File|Archivo|Imagen):/i, ""));
    const license = "CC BY-SA 4.0";
    out.sources.push(ref(`wikipedia-${lang}`, `Wikipedia (${lang})`, url, license));
    out.docs.push({ sourceId: `wikipedia-${lang}`, name: `Wikipedia (${lang})`, url, lang, text: extract || summary.extract || "", license });
    return { lang, title: page?.title ?? summary.title ?? title, url, summary: summary.extract ?? "", extract, paragraphs: paragraphs.slice(0, 10), imageFiles };
  });
}

// ---------------------------------------------------------------------------
// MusicBrainz (≤ 1 request / second)
// ---------------------------------------------------------------------------

const mbLimit = createRateLimiter(1100);

export interface MusicBrainzInfo {
  id: string;
  url: string;
  name: string;
  country?: string;
  beginDate?: string;
  beginArea?: string;
  urls: Array<{ type: string; url: string }>;
  releaseGroups: Array<{ id: string; title: string; firstReleaseDate?: string; primaryType?: string; secondaryTypes: string[] }>;
}

export function fetchMusicBrainz(mbid: string, log: Logger, timeoutMs: number): Promise<ProviderOutput<MusicBrainzInfo>> {
  return provider("musicbrainz", log, async (out) => {
    await mbLimit();
    const artist = await fetchJson<{
      name: string;
      country?: string;
      "life-span"?: { begin?: string };
      "begin-area"?: { name?: string };
      relations?: Array<{ type: string; url?: { resource: string } }>;
    }>(`https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels&fmt=json`, { timeoutMs });
    const groups: MusicBrainzInfo["releaseGroups"] = [];
    for (let offset = 0; offset < 300; offset += 100) {
      await mbLimit();
      const page = await fetchJson<{
        "release-group-count"?: number;
        "release-groups"?: Array<{ id: string; title: string; "first-release-date"?: string; "primary-type"?: string; "secondary-types"?: string[] }>;
      }>(`https://musicbrainz.org/ws/2/release-group?artist=${mbid}&type=album|ep&limit=100&offset=${offset}&fmt=json`, { timeoutMs });
      for (const g of page["release-groups"] ?? []) {
        groups.push({ id: g.id, title: g.title, firstReleaseDate: g["first-release-date"] || undefined, primaryType: g["primary-type"], secondaryTypes: g["secondary-types"] ?? [] });
      }
      if (groups.length >= (page["release-group-count"] ?? 0)) break;
    }
    const url = `https://musicbrainz.org/artist/${mbid}`;
    out.sources.push(ref("musicbrainz", "MusicBrainz", url, "CC0"));
    out.docs.push({
      sourceId: "musicbrainz",
      name: "MusicBrainz",
      url,
      text: `${artist.name}. ${artist["begin-area"]?.name ?? ""} ${artist["life-span"]?.begin ?? ""}. ${groups.map((g) => `${g.title} (${g.firstReleaseDate ?? "s/f"})`).join("; ")}`,
      license: "CC0",
    });
    return {
      id: mbid,
      url,
      name: artist.name,
      country: artist.country,
      beginDate: artist["life-span"]?.begin,
      beginArea: artist["begin-area"]?.name,
      urls: (artist.relations ?? []).filter((r) => r.url?.resource).map((r) => ({ type: r.type, url: r.url!.resource })),
      releaseGroups: groups,
    };
  });
}

// ---------------------------------------------------------------------------
// Deezer (public API, no key)
// ---------------------------------------------------------------------------

export interface DeezerInfo {
  artist: { id: number; name: string; nbFan: number; link: string; picture?: string };
  top: Array<{ id: number; title: string; duration: number; rank: number; preview?: string; link: string; album?: { id: number; title: string; cover?: string } }>;
  albums: Array<{ id: number; title: string; releaseDate?: string; coverXl?: string; link: string; recordType?: string }>;
}

export async function searchDeezerArtist(name: string, timeoutMs: number): Promise<number | null> {
  const res = await fetchJson<{ data?: Array<{ id: number; name: string; nb_fan: number }> }>(
    `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=10`,
    { timeoutMs },
  );
  const exact = (res.data ?? []).filter((a) => normalizeText(a.name) === normalizeText(name)).sort((a, b) => b.nb_fan - a.nb_fan);
  return exact[0]?.id ?? null;
}

export function fetchDeezer(id: number, log: Logger, timeoutMs: number, topLimit: number): Promise<ProviderOutput<DeezerInfo>> {
  return provider("deezer", log, async (out) => {
    type DzArtist = { id: number; name: string; nb_fan: number; link: string; picture_xl?: string; error?: unknown };
    const artist = await fetchJson<DzArtist>(`https://api.deezer.com/artist/${id}`, { timeoutMs });
    if (artist.error) throw new Error(`Deezer artist ${id} not found`);
    const top = await fetchJson<{ data?: Array<{ id: number; title: string; title_short?: string; duration: number; rank: number; preview?: string; link: string; album?: { id: number; title: string; cover_xl?: string } }> }>(
      `https://api.deezer.com/artist/${id}/top?limit=${Math.max(topLimit, 10)}`,
      { timeoutMs },
    );
    const albums = await fetchJson<{ data?: Array<{ id: number; title: string; release_date?: string; cover_xl?: string; link: string; record_type?: string }> }>(
      `https://api.deezer.com/artist/${id}/albums?limit=150`,
      { timeoutMs },
    );
    out.sources.push(ref("deezer", "Deezer", artist.link));
    return {
      artist: { id: artist.id, name: artist.name, nbFan: artist.nb_fan, link: artist.link, picture: artist.picture_xl },
      top: (top.data ?? []).map((t) => ({
        id: t.id,
        title: t.title_short ?? t.title,
        duration: t.duration,
        rank: t.rank,
        preview: t.preview || undefined,
        link: t.link,
        album: t.album ? { id: t.album.id, title: t.album.title, cover: t.album.cover_xl } : undefined,
      })),
      albums: (albums.data ?? []).map((a) => ({ id: a.id, title: a.title, releaseDate: a.release_date, coverXl: a.cover_xl, link: a.link, recordType: a.record_type })),
    };
  });
}

// ---------------------------------------------------------------------------
// iTunes Search (Apple Music links + 1000px artwork)
// ---------------------------------------------------------------------------

export interface ItunesInfo {
  artistUrl?: string;
  albums: Array<{ title: string; releaseDate?: string; artwork?: string; url?: string; trackCount?: number }>;
}

export function fetchItunes(name: string, log: Logger, timeoutMs: number): Promise<ProviderOutput<ItunesInfo>> {
  return provider("itunes", log, async (out) => {
    const albumsRes = await fetchJson<{ results?: Array<{ artistName: string; collectionName: string; releaseDate?: string; artworkUrl100?: string; collectionViewUrl?: string; trackCount?: number }> }>(
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=album&attribute=artistTerm&country=mx&limit=200`,
      { timeoutMs },
    );
    const artistRes = await fetchJson<{ results?: Array<{ artistName: string; artistLinkUrl?: string }> }>(
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&country=mx&limit=5`,
      { timeoutMs },
    );
    const target = normalizeText(name);
    const albums = (albumsRes.results ?? [])
      .filter((a) => normalizeText(a.artistName) === target)
      .map((a) => ({
        title: a.collectionName,
        releaseDate: a.releaseDate?.slice(0, 10),
        artwork: a.artworkUrl100?.replace(/\/\d+x\d+bb\./, "/1000x1000bb."),
        url: a.collectionViewUrl?.split("?")[0],
        trackCount: a.trackCount,
      }));
    const artistUrl = (artistRes.results ?? []).find((a) => normalizeText(a.artistName) === target)?.artistLinkUrl?.split("?")[0];
    if (!albums.length && !artistUrl) out.warnings.push("artist not found on iTunes");
    if (artistUrl) out.sources.push(ref("itunes", "Apple Music / iTunes", artistUrl));
    return { artistUrl, albums };
  });
}

// ---------------------------------------------------------------------------
// Extra sources (config/artist.json → extraSources) — for artists too small for the fixed provider
// list (no Wikidata/MusicBrainz/streaming catalog): a press article, an about page, a bio someone
// hand-picked. Fetched at runtime like every other source, never typed in as content.
// ---------------------------------------------------------------------------

/** `id` must be filesystem-safe (used for the raw-dump filename): callers pass e.g. "extra-1". */
export function fetchExtraSource(id: string, url: string, label: string | undefined, log: Logger, timeoutMs: number): Promise<ProviderOutput<{ text: string }>> {
  return provider(id, log, async (out) => {
    const html = await fetchText(url, { timeoutMs });
    const $ = cheerio.load(html);
    const title = label || $("title").first().text().trim() || new URL(url).hostname;
    const text = mainText($) || $("body").text().replace(/\s+/g, " ").trim();
    if (text.length < 80) {
      out.warnings.push("page has little or no extractable text (it may need a browser to render, or block fetching)");
      return undefined;
    }
    out.docs.push({ sourceId: id, name: title, url, text });
    out.sources.push(ref(id, title, url));
    return { text };
  });
}

// ---------------------------------------------------------------------------
// Official website
// ---------------------------------------------------------------------------

export interface OfficialSiteInfo {
  url: string;
  bioUrl?: string;
  bioParagraphs: string[];
  socials: Array<{ platform: SocialPlatform; href: string }>;
  youtubeIds: string[];
  ticketsUrl?: string;
  contactUrl?: string;
  emails: string[];
  news: Array<{ title: string; href: string; date?: string }>;
  tourUrl?: string;
  tourText?: string;
}

const NAV_NOISE = /^(inicio|home|menu|menú|biograf[ií]a|discograf[ií]a|fotos|videos|galer[ií]a|boletos|contrataciones|noticias|gira|suscribirse|creativos|programa|nuestros proyectos)$/i;

// A photo credit/caption ("Foto: Cortesía de X", "Courtesy of X") glued onto a real paragraph (e.g. a
// <figcaption> as a sibling of the body text, inside the same block-level container) would otherwise
// read as part of the article's prose.
const CAPTION_FRAGMENT = /\(?\s*(?:foto|photo)\s*:[^().]*\)?|\(?\s*(?:cortes[ií]a|courtesy)(?:\s+(?:de|of))?[^().]*\)?/gi;

function mainText($: cheerio.CheerioAPI): string {
  $("script, style, noscript, nav, header, footer, form, iframe, svg, button, select, figure, figcaption, [class*='caption' i], [class*='credit' i]").remove();
  const blocks: string[] = [];
  $("p, article, .content, main, section, div").each((_, el) => {
    const own = $(el).children("p, div, section, article").length === 0;
    if (!own) return;
    const text = $(el)
      .text()
      .replace(CAPTION_FRAGMENT, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length >= 140 && !NAV_NOISE.test(text)) blocks.push(text);
  });
  return [...new Set(blocks)].join("\n\n");
}

/** Heuristic: song lyrics are many short lines with repeated phrases and little punctuation. */
function looksLikeLyrics(text: string): boolean {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const punctuated = sentences.filter((s) => /[.!?]$/.test(s.trim())).length;
  const words = text.split(/\s+/);
  const unique = new Set(words.map((w) => w.toLowerCase())).size;
  return punctuated / Math.max(1, sentences.length) < 0.3 || unique / Math.max(1, words.length) < 0.35;
}

export function fetchOfficialSite(siteUrl: string, log: Logger, timeoutMs: number): Promise<ProviderOutput<OfficialSiteInfo>> {
  return provider("official-site", log, async (out) => {
    const base = siteUrl.replace(/^http:/, "https:").replace(/\/$/, "");
    const html = await fetchText(base, { timeoutMs, browserUA: true }).catch(() => fetchText(siteUrl, { timeoutMs, browserUA: true }));
    const $ = cheerio.load(html);
    const links = $("a[href]")
      .map((_, a) => ({ href: $(a).attr("href") ?? "", text: $(a).text().replace(/\s+/g, " ").trim() }))
      .get();
    const abs = (h: string) => {
      try {
        return new URL(h, `${base}/`).href;
      } catch {
        return "";
      }
    };
    const find = (re: RegExp) => links.map((l) => abs(l.href)).find((h) => h && re.test(h));
    const info: OfficialSiteInfo = { url: base, bioParagraphs: [], socials: [], youtubeIds: [], emails: [], news: [] };
    const socialSeen = new Set<string>();
    for (const l of links) {
      const href = abs(l.href);
      const platform = href ? platformFromUrl(href) : null;
      if (platform && !socialSeen.has(platform) && !/share|sharer|intent|watch\?/.test(href)) {
        socialSeen.add(platform);
        info.socials.push({ platform, href });
      }
      if (/ticketmaster|boletos|eticket|livenation/i.test(href) && !info.ticketsUrl && /^https?:/.test(href) && !href.startsWith(base)) info.ticketsUrl = href;
      if (/^mailto:/i.test(l.href)) info.emails.push(l.href.replace(/^mailto:/i, "").split("?")[0]);
    }
    info.bioUrl = find(/\/(biograf[ií]a|bio|about|acerca)\b/i);
    const videosUrl = find(/\/videos?\b/i);
    info.tourUrl = find(/\/(gira|tour|fechas|eventos|shows)\b/i);
    const newsUrl = find(/\/(noticias|news|blog|prensa)\b/i);
    info.contactUrl = find(/\/(contacto|contact|contrataciones|booking)\b/i);
    out.sources.push(ref("official-site", "Sitio oficial", base));
    out.docs.push({ sourceId: "official-site", name: "Sitio oficial", url: base, lang: "es", text: htmlToPlain(html) });

    if (info.bioUrl) {
      try {
        const bioHtml = await fetchText(info.bioUrl, { timeoutMs, browserUA: true });
        const text = mainText(cheerio.load(bioHtml));
        out.docs.push({ sourceId: "official-bio", name: "Sitio oficial — Biografía", url: info.bioUrl, lang: "es", text });
        for (const block of text.split(/\n{2,}/)) {
          if (looksLikeLyrics(block)) continue;
          info.bioParagraphs.push(...paragraphsFromText(block, 560));
        }
        info.bioParagraphs = [...new Set(info.bioParagraphs)].filter((p) => p.length >= 80);
        out.sources.push(ref("official-bio", "Sitio oficial — Biografía", info.bioUrl));
      } catch (err) {
        out.warnings.push(`biography page: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (videosUrl) {
      try {
        const vHtml = await fetchText(videosUrl, { timeoutMs, browserUA: true });
        const ids = [...vHtml.matchAll(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{11})/g)].map((m) => m[1]);
        info.youtubeIds = [...new Set(ids)];
      } catch (err) {
        out.warnings.push(`videos page: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (info.tourUrl) {
      try {
        const tHtml = await fetchText(info.tourUrl, { timeoutMs, browserUA: true });
        info.tourText = mainText(cheerio.load(tHtml)).slice(0, 2000) || htmlToPlain(tHtml).slice(0, 600);
        out.docs.push({ sourceId: "official-tour", name: "Sitio oficial — Gira", url: info.tourUrl, lang: "es", text: htmlToPlain(tHtml) });
      } catch (err) {
        out.warnings.push(`tour page: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (newsUrl) {
      try {
        const nHtml = await fetchText(newsUrl, { timeoutMs, browserUA: true });
        const $n = cheerio.load(nHtml);
        const seen = new Set<string>();
        $n("a[href]").each((_, a) => {
          const href = abs($n(a).attr("href") ?? "");
          const title = $n(a).text().replace(/\s+/g, " ").trim();
          if (!href || seen.has(href) || title.length < 18 || title.length > 160 || NAV_NOISE.test(title)) return;
          if (!/noticia|news|blog|prensa|\d{4}/i.test(href)) return;
          seen.add(href);
          info.news.push({ title, href });
        });
        info.news = info.news.slice(0, 8);
      } catch (err) {
        out.warnings.push(`news page: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (info.contactUrl) {
      try {
        const cHtml = await fetchText(info.contactUrl, { timeoutMs, browserUA: true });
        for (const m of cHtml.matchAll(/mailto:([^"'?\s>]+)/gi)) info.emails.push(m[1]);
      } catch {
        // contact page optional
      }
    }
    info.emails = [...new Set(info.emails.map((e) => e.toLowerCase()))].filter((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) && !/example|domain|tudominio/.test(e));
    return info;
  });
}

function htmlToPlain(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();
  return $.root().text().replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// YouTube (oEmbed titles + channel RSS)
// ---------------------------------------------------------------------------

export interface VideoInfo {
  youtubeId: string;
  title: string;
  author?: string;
  publishedAt?: string;
}

export function fetchYoutube(ids: string[], channelId: string | undefined, log: Logger, timeoutMs: number, max: number): Promise<ProviderOutput<VideoInfo[]>> {
  return provider("youtube", log, async (out) => {
    const videos: VideoInfo[] = [];
    for (const id of ids.slice(0, max * 2)) {
      if (videos.length >= max) break;
      try {
        const o = await fetchJson<{ title?: string; author_name?: string }>(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
          { timeoutMs, retries: 1 },
        );
        if (o.title) videos.push({ youtubeId: id, title: o.title, author: o.author_name });
      } catch {
        out.warnings.push(`video ${id} unavailable`);
      }
    }
    if (channelId && videos.length < max) {
      try {
        const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { timeoutMs });
        for (const entry of xml.split("<entry>").slice(1)) {
          const id = entry.match(/<yt:videoId>([^<]+)</)?.[1];
          const title = entry.match(/<title>([^<]+)</)?.[1];
          const published = entry.match(/<published>([^<]+)</)?.[1];
          if (id && title && !videos.some((v) => v.youtubeId === id)) videos.push({ youtubeId: id, title, publishedAt: published?.slice(0, 10) });
          if (videos.length >= max) break;
        }
      } catch {
        out.warnings.push("channel RSS unavailable");
      }
    }
    if (videos.length) out.sources.push(ref("youtube", "YouTube", "https://www.youtube.com"));
    return videos;
  });
}

// ---------------------------------------------------------------------------
// Wikimedia Commons (free-licensed photos)
// ---------------------------------------------------------------------------

export interface CommonsImage {
  file: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  author: string;
  license: string;
  licenseUrl?: string;
  descriptionUrl: string;
  description?: string;
}

const FREE_LICENSE = /cc0|cc[- ]by|public domain|dominio público|pd-|gfdl|attribution/i;

export function fetchCommons(files: string[], log: Logger, timeoutMs: number): Promise<ProviderOutput<CommonsImage[]>> {
  return provider("commons", log, async (out) => {
    const unique = [...new Set(files.map((f) => f.replace(/_/g, " ")))].slice(0, 12);
    if (!unique.length) return undefined;
    const titles = unique.map((f) => `File:${f}`).join("|");
    const data = await fetchJson<{
      query?: { pages?: Record<string, { title: string; imageinfo?: Array<{ url: string; thumburl?: string; thumbwidth?: number; thumbheight?: number; width: number; height: number; descriptionurl: string; extmetadata?: Record<string, { value?: string }> }> }> };
    }>(
      `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600&format=json&titles=${encodeURIComponent(titles)}`,
      { timeoutMs },
    );
    const images: CommonsImage[] = [];
    for (const page of Object.values(data.query?.pages ?? {})) {
      const ii = page.imageinfo?.[0];
      if (!ii) continue;
      const meta = ii.extmetadata ?? {};
      const license = stripTags(meta.LicenseShortName?.value ?? "");
      if (!FREE_LICENSE.test(license)) {
        out.warnings.push(`${page.title}: non-free license "${license}" skipped`);
        continue;
      }
      if (ii.width < 500 || ii.height < 400) continue;
      images.push({
        file: page.title.replace(/^File:/, ""),
        url: ii.url,
        thumbUrl: ii.thumburl ?? ii.url,
        width: ii.thumbwidth ?? ii.width,
        height: ii.thumbheight ?? ii.height,
        author: stripTags(meta.Artist?.value ?? "") || "Wikimedia Commons",
        license,
        licenseUrl: meta.LicenseUrl?.value,
        descriptionUrl: ii.descriptionurl,
        description: stripTags(meta.ImageDescription?.value ?? "").slice(0, 200) || undefined,
      });
    }
    if (images.length) out.sources.push(ref("commons", "Wikimedia Commons", "https://commons.wikimedia.org"));
    return images;
  });
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Spotify public artist page (JS-rendered → Playwright, best effort)
// ---------------------------------------------------------------------------

export interface SpotifyInfo {
  url: string;
  monthlyListeners?: string;
  popular: Array<{ title: string; plays: string }>;
}

export function fetchSpotifyPublic(artistId: string, log: Logger, timeoutMs: number): Promise<ProviderOutput<SpotifyInfo>> {
  return provider("spotify", log, async (out) => {
    const url = `https://open.spotify.com/artist/${artistId}`;
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        locale: "en-US",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await page.waitForSelector("text=/monthly listeners/i", { timeout: Math.min(timeoutMs, 20_000) }).catch(() => undefined);
      const text = String(await page.evaluate("document.body ? document.body.innerText : ''"));
      const listeners = text.match(/([\d.,]+\s*[KMB]?)\s+monthly listeners/i)?.[1]?.trim();
      const rows = (await page
        .evaluate(`Array.from(document.querySelectorAll('[data-testid="tracklist-row"]')).slice(0, 10).map(r => r.innerText)`)
        .catch(() => [])) as string[];
      const popular: SpotifyInfo["popular"] = [];
      for (const row of rows) {
        const lines = row.split("\n").map((l) => l.trim()).filter(Boolean);
        const plays = lines.find((l) => /^\d{1,3}(,\d{3})+$/.test(l));
        const title = lines.find((l) => !/^\d+$/.test(l) && l !== plays && !/^\d+:\d{2}$/.test(l) && l.toLowerCase() !== "e");
        if (title && plays) popular.push({ title, plays });
      }
      if (!listeners && !popular.length) {
        out.warnings.push("no public listener data rendered");
        return undefined;
      }
      out.sources.push(ref("spotify", "Spotify", url));
      out.docs.push({ sourceId: "spotify", name: "Spotify", url, text: `${listeners ?? ""} monthly listeners. ${popular.map((p) => `${p.title} ${p.plays}`).join("; ")}` });
      return { url, monthlyListeners: listeners, popular };
    } finally {
      await browser.close();
    }
  });
}

// ---------------------------------------------------------------------------
// Tour dates (real sources only — never invented)
// ---------------------------------------------------------------------------

export interface RawTourEvent {
  date: string;
  time?: string;
  venue: string;
  city: string;
  region?: string;
  country?: string;
  ticketUrl?: string;
  status: "on-sale" | "sold-out" | "announced" | "unknown";
  tourName?: string;
  source: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function fetchTicketmaster(apiKey: string, keyword: string, artistName: string, countries: string[], log: Logger, timeoutMs: number): Promise<ProviderOutput<RawTourEvent[]>> {
  return provider("ticketmaster", log, async (out) => {
    const events: RawTourEvent[] = [];
    for (const cc of countries) {
      const data = await fetchJson<{
        _embedded?: {
          events?: Array<{
            name: string;
            url?: string;
            dates?: { start?: { localDate?: string; localTime?: string }; status?: { code?: string } };
            _embedded?: { venues?: Array<{ name?: string; city?: { name?: string }; state?: { name?: string }; country?: { countryCode?: string } }>; attractions?: Array<{ name?: string }> };
          }>;
        };
      }>(
        `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${encodeURIComponent(apiKey)}&keyword=${encodeURIComponent(keyword)}&classificationName=music&sort=date,asc&size=50&countryCode=${cc}`,
        { timeoutMs },
      );
      for (const e of data._embedded?.events ?? []) {
        const attractions = (e._embedded?.attractions ?? []).map((a) => normalizeText(a.name ?? ""));
        if (!attractions.includes(normalizeText(artistName))) continue;
        const date = e.dates?.start?.localDate;
        const venue = e._embedded?.venues?.[0];
        if (!date || date < today() || !venue?.name) continue;
        const code = e.dates?.status?.code ?? "";
        events.push({
          date,
          time: e.dates?.start?.localTime?.slice(0, 5),
          venue: venue.name,
          city: venue.city?.name ?? "",
          region: venue.state?.name,
          country: venue.country?.countryCode,
          ticketUrl: e.url,
          status: code === "onsale" ? "on-sale" : code === "offsale" ? "sold-out" : "announced",
          tourName: e.name,
          source: "ticketmaster",
        });
      }
    }
    out.sources.push(ref("ticketmaster", "Ticketmaster", "https://www.ticketmaster.com"));
    return events;
  });
}

export function fetchBandsintown(appId: string, artistName: string, log: Logger, timeoutMs: number): Promise<ProviderOutput<RawTourEvent[]>> {
  return provider("bandsintown", log, async (out) => {
    const data = await fetchJson<Array<{ datetime?: string; venue?: { name?: string; city?: string; region?: string; country?: string }; offers?: Array<{ url?: string; status?: string }>; title?: string }>>(
      `https://rest.bandsintown.com/artists/${encodeURIComponent(artistName)}/events?app_id=${encodeURIComponent(appId)}`,
      { timeoutMs },
    );
    const events: RawTourEvent[] = [];
    for (const e of Array.isArray(data) ? data : []) {
      const date = e.datetime?.slice(0, 10);
      if (!date || date < today() || !e.venue?.name) continue;
      events.push({
        date,
        time: e.datetime?.slice(11, 16),
        venue: e.venue.name,
        city: e.venue.city ?? "",
        region: e.venue.region,
        country: e.venue.country,
        ticketUrl: e.offers?.[0]?.url,
        status: e.offers?.[0]?.status === "sold out" ? "sold-out" : e.offers?.length ? "on-sale" : "announced",
        tourName: e.title,
        source: "bandsintown",
      });
    }
    out.sources.push(ref("bandsintown", "Bandsintown", "https://www.bandsintown.com"));
    return events;
  });
}

/** Re-export for the synthesizer's title matching. */
export { titleKey };
