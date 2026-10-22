import path from "node:path";
import type { ProviderRun, SourceRef } from "../schemas/content-schema.js";
import type { FactoryContext } from "../utils/config.js";
import { writeJson } from "../utils/file-utils.js";
import type { Logger } from "../utils/logger.js";
import {
  fetchBandsintown,
  fetchCommons,
  fetchDeezer,
  fetchExtraSource,
  fetchItunes,
  fetchMusicBrainz,
  fetchOfficialSite,
  fetchSpotifyPublic,
  fetchTicketmaster,
  fetchWikidata,
  fetchWikipedia,
  fetchYoutube,
  platformFromUrl,
  searchDeezerArtist,
  searchWikidata,
  type CommonsImage,
  type DeezerInfo,
  type ItunesInfo,
  type MusicBrainzInfo,
  type OfficialSiteInfo,
  type ProviderOutput,
  type RawTourEvent,
  type SourceDoc,
  type SpotifyInfo,
  type VideoInfo,
  type WikidataInfo,
  type WikiPage,
} from "./providers/sources.js";

export type { SourceDoc } from "./providers/sources.js";

/**
 * Fetch everything public about the artist (Phase 5, step 1).
 * Identity resolution: config anchors → Wikidata → MusicBrainz url-rels → Spotify / official site /
 * socials → Deezer. Every provider is independent; failures are recorded, never fatal.
 * Raw provider dumps are written to artifacts/marisela-content/raw/<provider>.json for auditing.
 */

export interface RawSourceBundle {
  resolved: {
    wikidataId?: string;
    musicbrainzId?: string;
    spotifyArtistId?: string;
    deezerArtistId?: number;
    officialSite?: string;
    wikipediaTitles: { es?: string; en?: string };
  };
  wikidata?: WikidataInfo;
  wikipedia: { es?: WikiPage; en?: WikiPage };
  musicbrainz?: MusicBrainzInfo;
  deezer?: DeezerInfo;
  itunes?: ItunesInfo;
  official?: OfficialSiteInfo;
  videos: VideoInfo[];
  commons: CommonsImage[];
  spotify?: SpotifyInfo;
  tourEvents: RawTourEvent[];
  docs: SourceDoc[];
  sources: SourceRef[];
  providers: ProviderRun[];
  warnings: string[];
}

export async function fetchAllSources(ctx: FactoryContext, logger: Logger): Promise<RawSourceBundle> {
  const log = logger.child("content");
  const cfg = ctx.config.tools.contentFetch;
  const t = cfg.timeoutMs;
  const artist = ctx.artist;
  const rawDir = path.join(ctx.paths.contentDir, "raw");
  const bundle: RawSourceBundle = {
    resolved: { wikipediaTitles: { es: artist.anchors.wikipediaTitles.es ?? undefined, en: artist.anchors.wikipediaTitles.en ?? undefined } },
    wikipedia: {},
    videos: [],
    commons: [],
    tourEvents: [],
    docs: [],
    sources: [],
    providers: [],
    warnings: [],
  };
  const absorb = async <T>(name: string, out: ProviderOutput<T>): Promise<T | undefined> => {
    bundle.docs.push(...out.docs);
    bundle.sources.push(...out.sources);
    bundle.providers.push(out.run);
    bundle.warnings.push(...out.warnings.map((w) => `${name}: ${w}`));
    if (out.data !== undefined) await writeJson(path.join(rawDir, `${name}.json`), out.data);
    return out.data;
  };

  // 1. Wikidata (identity anchor)
  let wikidataId = artist.anchors.wikidataId ?? undefined;
  if (!wikidataId) {
    wikidataId = (await searchWikidata(artist.searchName, t).catch(() => null)) ?? undefined;
    if (wikidataId) log.info(`Resolved Wikidata entity ${wikidataId} for "${artist.searchName}"`);
  }
  if (wikidataId) {
    bundle.resolved.wikidataId = wikidataId;
    bundle.wikidata = await absorb("wikidata", await fetchWikidata(wikidataId, log, t));
  }
  const wd = bundle.wikidata;
  bundle.resolved.wikipediaTitles.es ??= wd?.sitelinks.es;
  bundle.resolved.wikipediaTitles.en ??= wd?.sitelinks.en;

  // 2. Wikipedia es/en + MusicBrainz in parallel
  const mbid = artist.anchors.musicbrainzId ?? wd?.ids.musicbrainz;
  const [es, en, mb] = await Promise.all([
    bundle.resolved.wikipediaTitles.es ? fetchWikipedia("es", bundle.resolved.wikipediaTitles.es, log, t) : null,
    bundle.resolved.wikipediaTitles.en ? fetchWikipedia("en", bundle.resolved.wikipediaTitles.en, log, t) : null,
    mbid ? fetchMusicBrainz(mbid, log, t) : null,
  ]);
  if (es) bundle.wikipedia.es = await absorb("wikipedia-es", es);
  if (en) bundle.wikipedia.en = await absorb("wikipedia-en", en);
  if (mb) bundle.musicbrainz = await absorb("musicbrainz", mb);
  if (mbid) bundle.resolved.musicbrainzId = mbid;

  // 3. Derived identifiers from MusicBrainz url-rels / Wikidata
  const mbUrls = bundle.musicbrainz?.urls ?? [];
  const spotifyFromMb = mbUrls.map((u) => u.url.match(/open\.spotify\.com\/artist\/([A-Za-z0-9]+)/)?.[1]).find(Boolean);
  bundle.resolved.spotifyArtistId = artist.anchors.spotifyArtistId ?? wd?.ids.spotify ?? spotifyFromMb;
  const officialFromMb = mbUrls.find((u) => u.type === "official homepage")?.url;
  bundle.resolved.officialSite = artist.anchors.officialSite ?? wd?.officialSite ?? officialFromMb;

  // 4. Deezer id
  const name = wd?.label.es ?? wd?.label.en ?? artist.searchName;
  let deezerId = artist.anchors.deezerArtistId ? Number(artist.anchors.deezerArtistId) : wd?.ids.deezer ? Number(wd.ids.deezer) : undefined;
  if (!deezerId) deezerId = (await searchDeezerArtist(name, t).catch(() => null)) ?? undefined;
  if (deezerId) bundle.resolved.deezerArtistId = deezerId;

  // 5. Deezer / iTunes / official site in parallel
  const [dz, it, off] = await Promise.all([
    deezerId ? fetchDeezer(deezerId, log, t, cfg.maxTopSongs) : null,
    fetchItunes(name, log, t),
    bundle.resolved.officialSite ? fetchOfficialSite(bundle.resolved.officialSite, log, t) : null,
  ]);
  if (dz) bundle.deezer = await absorb("deezer", dz);
  bundle.itunes = await absorb("itunes", it);
  if (off) bundle.official = await absorb("official-site", off);

  // 6. Videos (official site embeds + channel RSS), Commons photos, Spotify public data
  const ytChannel = wd?.ids.youtubeChannel;
  const commonsFiles = [wd?.commonsImage, ...(bundle.wikipedia.es?.imageFiles ?? []), ...(bundle.wikipedia.en?.imageFiles ?? [])].filter((f): f is string => Boolean(f));
  const [yt, commons] = await Promise.all([
    fetchYoutube(bundle.official?.youtubeIds ?? [], ytChannel, log, t, cfg.maxVideos),
    fetchCommons(commonsFiles, log, t),
  ]);
  bundle.videos = (await absorb("youtube", yt)) ?? [];
  bundle.commons = (await absorb("commons", commons)) ?? [];
  if (cfg.useBrowser && bundle.resolved.spotifyArtistId) {
    bundle.spotify = await absorb("spotify", await fetchSpotifyPublic(bundle.resolved.spotifyArtistId, log, Math.min(t, 30_000)));
  }

  // 6b. Extra sources (config/artist.json → extraSources): press/bio pages outside the fixed
  // provider list, for an artist too small to have a Wikidata entry or a streaming catalog.
  for (const [i, extra] of artist.extraSources.entries()) {
    const id = `extra-${i + 1}`;
    await absorb(id, await fetchExtraSource(id, extra.url, extra.label, log, t));
  }

  // 7. Tour dates — only from real event sources.
  if (ctx.env.ticketmasterApiKey) {
    const tm = await fetchTicketmaster(ctx.env.ticketmasterApiKey, artist.ticketSearch.ticketmasterKeyword, name, artist.ticketSearch.countryCodes, log, t);
    bundle.tourEvents.push(...((await absorb("ticketmaster", tm)) ?? []));
  } else {
    bundle.providers.push({ id: "ticketmaster", status: "skipped", durationMs: 0, detail: "TICKETMASTER_API_KEY not set" });
  }
  if (ctx.env.bandsintownAppId) {
    const bit = await fetchBandsintown(ctx.env.bandsintownAppId, name, log, t);
    bundle.tourEvents.push(...((await absorb("bandsintown", bit)) ?? []));
  } else {
    bundle.providers.push({ id: "bandsintown", status: "skipped", durationMs: 0, detail: "BANDSINTOWN_APP_ID not set" });
  }

  // Social links surfaced by Wikidata/MusicBrainz are merged by the synthesizer; record a doc for claims.
  const socialUrls = mbUrls.filter((u) => platformFromUrl(u.url)).map((u) => u.url);
  if (socialUrls.length) log.debug(`[content] MusicBrainz social/streaming links: ${socialUrls.join(", ")}`);

  const ok = bundle.providers.filter((p) => p.status === "ok" || p.status === "partial").length;
  log.info(`Fetched ${bundle.docs.length} source documents from ${ok}/${bundle.providers.length} providers`);
  return bundle;
}
