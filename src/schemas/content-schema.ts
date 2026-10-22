import { z } from "zod";

/**
 * Artist content, fetched at runtime from public sources by
 * `src/agents/content-synthesizer.ts` and stored at
 * `artifacts/marisela-content/content.json` (ContentDocument).
 *
 * `ArtistContent` is exactly what each generated site receives in `lib/content.ts`
 * (the content injector strips `meta` and every `localFile` field).
 * The site-side TypeScript mirror lives in `templates/shared/lib/types.ts` — keep both in sync.
 *
 * Rules:
 * - Nothing here may be invented. Every value comes from a fetched source (see `meta.fieldSources`)
 *   or is derived mechanically from fetched values (counts, years).
 * - Optional fields are omitted (not empty strings) when unknown.
 */

export const LinkItemSchema = z.object({
  label: z.string(),
  href: z.string(),
  external: z.boolean().optional(),
});
export type LinkItem = z.infer<typeof LinkItemSchema>;

export const ImageAssetSchema = z.object({
  /** Site URL path served from `public/`, e.g. "/images/hero.jpg", or an absolute https URL. */
  src: z.string(),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  credit: z.string().optional(),
  license: z.string().optional(),
  sourceUrl: z.string().optional(),
  /** True for generated placeholder art. */
  placeholder: z.boolean().optional(),
  /** Artifact-only: path of the downloaded file relative to the repo root. Stripped before injection. */
  localFile: z.string().optional(),
});
export type ImageAsset = z.infer<typeof ImageAssetSchema>;

export const PlatformLinksSchema = z.object({
  spotify: z.string().optional(),
  appleMusic: z.string().optional(),
  deezer: z.string().optional(),
  youtube: z.string().optional(),
});
export type PlatformLinks = z.infer<typeof PlatformLinksSchema>;

export const AlbumTypeSchema = z.enum(["album", "live", "compilation", "single", "ep"]);

export const AlbumSchema = z.object({
  id: z.string(),
  title: z.string(),
  year: z.number().int().optional(),
  /** ISO date (yyyy-mm-dd or yyyy) when known. */
  releaseDate: z.string().optional(),
  type: AlbumTypeSchema,
  cover: ImageAssetSchema.optional(),
  trackCount: z.number().int().optional(),
  links: PlatformLinksSchema,
  /** True for landmark releases (debut, best-known), set mechanically (e.g. debut = earliest). */
  highlight: z.boolean().optional(),
});
export type Album = z.infer<typeof AlbumSchema>;

export const SongSchema = z.object({
  id: z.string(),
  title: z.string(),
  album: z.string().optional(),
  year: z.number().int().optional(),
  durationSec: z.number().int().optional(),
  /** 1-based popularity rank (1 = most popular). */
  rank: z.number().int().positive(),
  /** Human-readable play count when a source provides one, e.g. "45.2M". */
  streams: z.string().optional(),
  /** Other popularity signal, e.g. "Deezer rank 612,301". */
  popularity: z.string().optional(),
  /** 30-second preview MP3 URL (Deezer/iTunes) when available. */
  previewUrl: z.string().optional(),
  links: PlatformLinksSchema,
});
export type Song = z.infer<typeof SongSchema>;

export const TourEventSchema = z.object({
  id: z.string(),
  /** ISO date yyyy-mm-dd. */
  date: z.string(),
  time: z.string().optional(),
  venue: z.string(),
  city: z.string(),
  region: z.string().optional(),
  country: z.string().optional(),
  ticketUrl: z.string().optional(),
  status: z.enum(["on-sale", "sold-out", "announced", "unknown"]),
  tourName: z.string().optional(),
});
export type TourEvent = z.infer<typeof TourEventSchema>;

export const VideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  youtubeId: z.string(),
  publishedAt: z.string().optional(),
  thumbnail: ImageAssetSchema.optional(),
});
export type Video = z.infer<typeof VideoSchema>;

export const QuoteSchema = z.object({
  id: z.string(),
  /** Verbatim text found in the cited source. */
  quote: z.string(),
  author: z.string().optional(),
  /** Publication / source name, e.g. "Wikipedia (es)", "Sitio oficial". */
  outlet: z.string(),
  url: z.string().optional(),
  year: z.number().int().optional(),
});
export type Quote = z.infer<typeof QuoteSchema>;

export const StatSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  detail: z.string().optional(),
  sourceUrl: z.string().optional(),
});
export type Stat = z.infer<typeof StatSchema>;

export const FactSchema = z.object({ label: z.string(), value: z.string() });
export type Fact = z.infer<typeof FactSchema>;

export const SocialPlatformSchema = z.enum([
  "spotify",
  "apple-music",
  "deezer",
  "youtube",
  "instagram",
  "facebook",
  "tiktok",
  "x",
  "website",
  "amazon-music",
  "soundcloud",
  "other",
]);
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;

export const SocialLinkSchema = z.object({
  platform: SocialPlatformSchema,
  label: z.string(),
  href: z.string(),
  handle: z.string().optional(),
});
export type SocialLink = z.infer<typeof SocialLinkSchema>;

export const NewsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string().optional(),
  href: z.string(),
  summary: z.string().optional(),
});
export type NewsItem = z.infer<typeof NewsItemSchema>;

export const BiographySchema = z.object({
  /** 1–2 sentence summary. */
  summary: z.string(),
  /** Full biography split into paragraphs (site language). */
  paragraphs: z.array(z.string()),
  /** Key facts for a fact sheet, e.g. { label: "Origen", value: "Los Ángeles, California" }. */
  facts: z.array(FactSchema),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  origin: z.string().optional(),
  genres: z.array(z.string()),
  yearsActive: z.string().optional(),
  debutYear: z.number().int().optional(),
  labels: z.array(z.string()),
  image: ImageAssetSchema.optional(),
  /** Attribution line for the biography text, e.g. "Fuente: Wikipedia (CC BY-SA 4.0) y sitio oficial". */
  sourceNote: z.string().optional(),
  sources: z.array(LinkItemSchema),
});
export type Biography = z.infer<typeof BiographySchema>;

export const StatsSchema = z.object({
  monthlyListeners: z.string().optional(),
  totalStreams: z.string().optional(),
  albumsSold: z.string().optional(),
  discographyCount: z.number().int().nonnegative(),
  deezerFans: z.string().optional(),
  yearsActive: z.string().optional(),
  /** Display-ready stat cards, already verified and formatted. */
  items: z.array(StatSchema),
});
export type Stats = z.infer<typeof StatsSchema>;

export const ArtistContentSchema = z.object({
  name: z.string(),
  legalName: z.string().optional(),
  aliases: z.array(z.string()),
  tagline: z.string(),
  shortBio: z.string(),
  lang: z.enum(["es", "en"]),
  locale: z.string(),
  biography: BiographySchema,
  discography: z.array(AlbumSchema),
  topSongs: z.array(SongSchema),
  tourDates: z.array(TourEventSchema),
  tour: z.object({
    name: z.string().optional(),
    ticketsUrl: z.string().optional(),
    note: z.string().optional(),
  }),
  videos: z.array(VideoSchema),
  images: z.object({
    hero: ImageAssetSchema.optional(),
    portrait: ImageAssetSchema.optional(),
    gallery: z.array(ImageAssetSchema),
  }),
  socialLinks: z.array(SocialLinkSchema),
  pressQuotes: z.array(QuoteSchema),
  stats: StatsSchema,
  news: z.array(NewsItemSchema),
  contact: z.object({
    bookingEmail: z.string().optional(),
    bookingUrl: z.string().optional(),
    phone: z.string().optional(),
    managementName: z.string().optional(),
  }),
  spotifyArtistId: z.string().optional(),
  officialSite: z.string().optional(),
  credits: z.object({
    sources: z.array(LinkItemSchema),
    imageCredits: z.array(z.string()),
    generatedAt: z.string(),
    disclaimer: z.string().optional(),
  }),
});
export type ArtistContent = z.infer<typeof ArtistContentSchema>;

// ---------------------------------------------------------------------------
// Artifact-only metadata (provenance, verification, provider runs)
// ---------------------------------------------------------------------------

export const SourceRefSchema = z.object({
  /** Stable id, e.g. "wikipedia-es", "musicbrainz", "deezer", "official-site". */
  id: z.string(),
  name: z.string(),
  url: z.string(),
  retrievedAt: z.string(),
  license: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const ClaimCheckSchema = z.object({
  id: z.string(),
  claim: z.string(),
  status: z.enum(["verified", "unverified", "contradicted"]),
  /** Verbatim snippet from a source supporting (or contradicting) the claim. */
  evidence: z.string().optional(),
  sourceIds: z.array(z.string()),
  note: z.string().optional(),
});
export type ClaimCheck = z.infer<typeof ClaimCheckSchema>;

export const ProviderRunSchema = z.object({
  id: z.string(),
  status: z.enum(["ok", "partial", "skipped", "failed"]),
  durationMs: z.number(),
  detail: z.string().optional(),
});
export type ProviderRun = z.infer<typeof ProviderRunSchema>;

export const ContentMetaSchema = z.object({
  schemaVersion: z.literal(1),
  artistSlug: z.string(),
  generatedAt: z.string(),
  requestedDisplayName: z.string().optional(),
  sources: z.array(SourceRefSchema),
  /** Field path (JSON pointer into ArtistContent, e.g. "/biography/paragraphs") → source ids. */
  fieldSources: z.record(z.string(), z.array(z.string())),
  claims: z.array(ClaimCheckSchema),
  providers: z.array(ProviderRunSchema),
  /** True when the LLM was used for synthesis (biography rewrite / quote selection). */
  llmUsed: z.boolean(),
  warnings: z.array(z.string()),
});
export type ContentMeta = z.infer<typeof ContentMetaSchema>;

/** Shape of artifacts/marisela-content/content.json: ArtistContent fields at the top level plus `meta`. */
export const ContentDocumentSchema = ArtistContentSchema.extend({
  meta: ContentMetaSchema,
});
export type ContentDocument = z.infer<typeof ContentDocumentSchema>;
