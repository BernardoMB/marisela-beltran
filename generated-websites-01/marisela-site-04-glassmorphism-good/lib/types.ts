/**
 * Shared type contract for every generated site.
 *
 * - Content types mirror `src/schemas/content-schema.ts` (ArtistContent) in the factory repo.
 * - Component prop types are the contract between the json-render catalog
 *   (`src/generators/component-registry.ts`), the spec renderer that writes `app/page.tsx`,
 *   and the per-brief component implementations in `templates/briefs/<brief>/components/`.
 *
 * Every brief MUST implement every component below with exactly these props
 * (it may ignore optional props, but must accept them).
 */

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export interface LinkItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface ImageAsset {
  /** Path under public/ (e.g. "/images/hero.jpg") or absolute https URL. */
  src: string;
  alt: string;
  width: number;
  height: number;
  credit?: string;
  license?: string;
  sourceUrl?: string;
  /** True for generated placeholder art (render it, but do not credit it). */
  placeholder?: boolean;
}

export interface PlatformLinks {
  spotify?: string;
  appleMusic?: string;
  deezer?: string;
  youtube?: string;
}

export type AlbumType = "album" | "live" | "compilation" | "single" | "ep";

export interface Album {
  id: string;
  title: string;
  year?: number;
  releaseDate?: string;
  type: AlbumType;
  cover?: ImageAsset;
  trackCount?: number;
  links: PlatformLinks;
  highlight?: boolean;
}

export interface Song {
  id: string;
  title: string;
  album?: string;
  year?: number;
  durationSec?: number;
  /** 1 = most popular. */
  rank: number;
  /** e.g. "45.2M" — only when a source provides it. */
  streams?: string;
  popularity?: string;
  /** 30-second MP3 preview URL. */
  previewUrl?: string;
  links: PlatformLinks;
}

export interface TourEvent {
  id: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  time?: string;
  venue: string;
  city: string;
  region?: string;
  country?: string;
  ticketUrl?: string;
  status: "on-sale" | "sold-out" | "announced" | "unknown";
  tourName?: string;
}

export interface Video {
  id: string;
  title: string;
  youtubeId: string;
  publishedAt?: string;
  thumbnail?: ImageAsset;
}

export interface Quote {
  id: string;
  /** Verbatim text from the cited source. */
  quote: string;
  author?: string;
  outlet: string;
  url?: string;
  year?: number;
}

export interface Stat {
  id: string;
  label: string;
  value: string;
  detail?: string;
  sourceUrl?: string;
}

export interface Fact {
  label: string;
  value: string;
}

export type SocialPlatform =
  | "spotify"
  | "apple-music"
  | "deezer"
  | "youtube"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "x"
  | "website"
  | "amazon-music"
  | "soundcloud"
  | "other";

export interface SocialLink {
  platform: SocialPlatform;
  label: string;
  href: string;
  handle?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  date?: string;
  href: string;
  summary?: string;
}

export interface Biography {
  summary: string;
  paragraphs: string[];
  facts: Fact[];
  birthDate?: string;
  birthPlace?: string;
  origin?: string;
  genres: string[];
  yearsActive?: string;
  debutYear?: number;
  labels: string[];
  image?: ImageAsset;
  sourceNote?: string;
  sources: LinkItem[];
}

export interface Stats {
  monthlyListeners?: string;
  totalStreams?: string;
  albumsSold?: string;
  discographyCount: number;
  deezerFans?: string;
  yearsActive?: string;
  items: Stat[];
}

export interface ArtistContent {
  name: string;
  legalName?: string;
  aliases: string[];
  tagline: string;
  shortBio: string;
  lang: "es" | "en";
  locale: string;
  biography: Biography;
  discography: Album[];
  topSongs: Song[];
  tourDates: TourEvent[];
  tour: { name?: string; ticketsUrl?: string; note?: string };
  videos: Video[];
  images: { hero?: ImageAsset; portrait?: ImageAsset; gallery: ImageAsset[] };
  socialLinks: SocialLink[];
  pressQuotes: Quote[];
  stats: Stats;
  news: NewsItem[];
  contact: { bookingEmail?: string; bookingUrl?: string; phone?: string; managementName?: string };
  spotifyArtistId?: string;
  officialSite?: string;
  credits: { sources: LinkItem[]; imageCredits: string[]; generatedAt: string; disclaimer?: string };
}

// ---------------------------------------------------------------------------
// Component props (json-render catalog contract)
// ---------------------------------------------------------------------------

/** Every section component renders `<section id={anchorId}>` so nav anchors work. */
export interface SectionBaseProps {
  anchorId?: string;
  /** Free-form layout hint chosen by json-render; each brief documents the values it supports in manifest.json. */
  variant?: string;
}

export interface NavBarProps {
  brand: string;
  /** In-page anchors ("#discografia") and/or external links. */
  links: LinkItem[];
  cta?: LinkItem;
  socials?: SocialLink[];
}

export interface HeroProps extends SectionBaseProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  tagline?: string;
  primaryCta?: LinkItem;
  secondaryCta?: LinkItem;
  image?: ImageAsset;
  stats?: Stat[];
  showScrollIndicator?: boolean;
  /** YouTube video id streamed as a muted, looping full-viewport background. */
  backgroundVideoId?: string;
}

export interface StatsBandProps extends SectionBaseProps {
  title?: string;
  eyebrow?: string;
  items: Stat[];
  note?: string;
}

export interface BiographyProps extends SectionBaseProps {
  title: string;
  eyebrow?: string;
  /** Optional standfirst shown before the paragraphs. */
  lead?: string;
  paragraphs: string[];
  facts?: Fact[];
  image?: ImageAsset;
  sourceNote?: string;
  /** Collapse after this many paragraphs (with a "read more" toggle). */
  maxParagraphs?: number;
}

export interface DiscographyProps extends SectionBaseProps {
  title: string;
  eyebrow?: string;
  intro?: string;
  albums: Album[];
  /** Layout chosen by json-render; see the brief's manifest.json for supported values. */
  layout?: "grid" | "list" | "timeline" | "carousel";
  limit?: number;
  showTypes?: boolean;
}

export interface TopSongsProps extends SectionBaseProps {
  title: string;
  eyebrow?: string;
  intro?: string;
  songs: Song[];
  limit?: number;
  /** Show the streams/popularity column when data exists. */
  showStats?: boolean;
}

export interface TourDatesProps extends SectionBaseProps {
  title: string;
  eyebrow?: string;
  intro?: string;
  events: TourEvent[];
  tourName?: string;
  /** General tickets / search URL, used for the CTA and the empty state. */
  ticketsUrl?: string;
  /** Shown when `events` is empty — never invent dates. */
  emptyTitle: string;
  emptyMessage: string;
  ctaLabel?: string;
}

export interface VideoGalleryProps extends SectionBaseProps {
  title: string;
  eyebrow?: string;
  intro?: string;
  videos: Video[];
  limit?: number;
  channelUrl?: string;
}

export interface PhotoGalleryProps extends SectionBaseProps {
  title: string;
  eyebrow?: string;
  images: ImageAsset[];
  limit?: number;
}

export interface MusicPlayerProps extends SectionBaseProps {
  title: string;
  eyebrow?: string;
  intro?: string;
  /** Renders the Spotify embed `https://open.spotify.com/embed/artist/<id>` when present. */
  spotifyArtistId?: string;
  /** Streaming platform links shown next to / instead of the player. */
  links: SocialLink[];
}

export interface PressQuotesProps extends SectionBaseProps {
  title: string;
  eyebrow?: string;
  quotes: Quote[];
  limit?: number;
}

export interface NewsletterProps extends SectionBaseProps {
  title: string;
  eyebrow?: string;
  body?: string;
  placeholder: string;
  buttonLabel: string;
  successMessage: string;
  errorMessage: string;
  privacyNote?: string;
}

export interface SocialLinksProps extends SectionBaseProps {
  title: string;
  eyebrow?: string;
  intro?: string;
  links: SocialLink[];
}

export interface ContactBookingProps extends SectionBaseProps {
  title: string;
  eyebrow?: string;
  body?: string;
  email?: string;
  bookingUrl?: string;
  phone?: string;
  links?: LinkItem[];
}

export interface FeatureItem {
  title: string;
  description?: string;
  href?: string;
}

/** Generic section for union features without a dedicated component (merch, fan club, news…). */
export interface FeatureSectionProps extends SectionBaseProps {
  /** Feature type key from config/feature-map.json, e.g. "merch", "news", "countdown". */
  featureType: string;
  title: string;
  eyebrow?: string;
  body?: string;
  items?: FeatureItem[];
  cta?: LinkItem;
}

export interface SectionDividerProps {
  label?: string;
  variant?: string;
}

export interface FooterProps {
  brand: string;
  tagline?: string;
  links: LinkItem[];
  socials: SocialLink[];
  copyright: string;
  /** Attribution lines (content sources, image licenses). Always render them. */
  credits: string[];
  sources?: LinkItem[];
}
