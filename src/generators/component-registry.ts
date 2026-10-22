import path from "node:path";
import { defineCatalog, type Catalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import fs from "fs-extra";
import { z } from "zod";
import type { UnionManifest } from "../schemas/feature-manifest.js";
import type { DesignBrief, FactoryContext, FeatureMap } from "../utils/config.js";
import { readJson } from "../utils/file-utils.js";
import { logger } from "../utils/logger.js";

/**
 * json-render component catalog: the guardrails the page composer (LLM or deterministic) works within.
 * Every component maps to a React component implemented once per design brief
 * (templates/briefs/<id>/components/<Name>.tsx) with the prop contract of templates/shared/lib/types.ts.
 * Data props are bound to the fetched artist content with `{ "$state": "/json/pointer" }`.
 */

export const CATALOG_COMPONENTS = [
  "Page",
  "NavBar",
  "Hero",
  "StatsBand",
  "Biography",
  "Discography",
  "TopSongs",
  "TourDates",
  "VideoGallery",
  "PhotoGallery",
  "MusicPlayer",
  "PressQuotes",
  "Newsletter",
  "SocialLinks",
  "ContactBooking",
  "FeatureSection",
  "SectionDivider",
  "Footer",
] as const;
export type CatalogComponentName = (typeof CATALOG_COMPONENTS)[number];

/** Components rendered by the site (everything except the json-render root). */
export const SITE_COMPONENTS = CATALOG_COMPONENTS.filter((c) => c !== "Page");

export interface BriefManifest {
  briefId: string;
  components: string[];
  /** Component → supported `variant` values (Discography: supported `layout` values). First = default. */
  variants: Partial<Record<CatalogComponentName, string[]>>;
  notes?: string;
}

const DEFAULT_VARIANTS: Partial<Record<CatalogComponentName, string[]>> = {
  Hero: ["default"],
  Discography: ["grid", "list"],
  SectionDivider: ["default"],
};

export async function loadBriefManifest(ctx: FactoryContext, brief: DesignBrief): Promise<BriefManifest> {
  const file = path.join(ctx.paths.root, brief.templateDir, "manifest.json");
  try {
    if (await fs.pathExists(file)) {
      const data = await readJson<Partial<BriefManifest>>(file);
      return {
        briefId: data.briefId ?? brief.id,
        components: data.components ?? [...SITE_COMPONENTS],
        variants: { ...DEFAULT_VARIANTS, ...(data.variants ?? {}) },
        notes: data.notes,
      };
    }
  } catch (err) {
    logger.warn(`Invalid manifest ${file} — using defaults`, err);
  }
  logger.warn(`Brief manifest missing for ${brief.id} — using default variants`);
  return { briefId: brief.id, components: [...SITE_COMPONENTS], variants: { ...DEFAULT_VARIANTS } };
}

const ANCHORS: Record<"es" | "en", Record<string, string>> = {
  es: {
    hero: "inicio",
    "music-player": "escuchar",
    discography: "discografia",
    "top-songs": "canciones",
    "tour-dates": "gira",
    biography: "biografia",
    stats: "cifras",
    video: "videos",
    "photo-gallery": "galeria",
    "press-quotes": "prensa",
    newsletter: "boletin",
    contact: "contacto",
    "social-links": "redes",
    merch: "tienda",
    "fan-club": "club",
    countdown: "proximamente",
    news: "noticias",
    lyrics: "letras",
  },
  en: {
    hero: "home",
    "music-player": "listen",
    discography: "discography",
    "top-songs": "songs",
    "tour-dates": "tour",
    biography: "biography",
    stats: "stats",
    video: "videos",
    "photo-gallery": "gallery",
    "press-quotes": "press",
    newsletter: "newsletter",
    contact: "contact",
    "social-links": "social",
    merch: "store",
    "fan-club": "fan-club",
    countdown: "coming-soon",
    news: "news",
    lyrics: "lyrics",
  },
};

export function anchorIdFor(featureType: string, lang: "es" | "en"): string {
  return ANCHORS[lang][featureType] ?? featureType.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
}

/** Canonical content bindings, enforced on every spec so data can never be invented. */
export const CANONICAL_BINDINGS: Partial<Record<CatalogComponentName, Record<string, string>>> = {
  NavBar: { socials: "/socialLinks" },
  Hero: { image: "/images/hero", stats: "/stats/items" },
  StatsBand: { items: "/stats/items" },
  Biography: { paragraphs: "/biography/paragraphs", facts: "/biography/facts", image: "/images/portrait", sourceNote: "/biography/sourceNote" },
  Discography: { albums: "/discography" },
  TopSongs: { songs: "/topSongs" },
  TourDates: { events: "/tourDates", ticketsUrl: "/tour/ticketsUrl", tourName: "/tour/name" },
  VideoGallery: { videos: "/videos" },
  PhotoGallery: { images: "/images/gallery" },
  MusicPlayer: { spotifyArtistId: "/spotifyArtistId", links: "/socialLinks" },
  PressQuotes: { quotes: "/pressQuotes" },
  SocialLinks: { links: "/socialLinks" },
  ContactBooking: { email: "/contact/bookingEmail", bookingUrl: "/contact/bookingUrl", phone: "/contact/phone" },
  Footer: { socials: "/socialLinks", sources: "/credits/sources" },
};

/** JSON pointers into ArtistContent that may be bound with $state. */
export const STATE_PATHS = [
  "/name",
  "/legalName",
  "/aliases",
  "/tagline",
  "/shortBio",
  "/biography/summary",
  "/biography/paragraphs",
  "/biography/facts",
  "/biography/sourceNote",
  "/biography/debutYear",
  "/discography",
  "/topSongs",
  "/tourDates",
  "/tour/name",
  "/tour/ticketsUrl",
  "/videos",
  "/images/hero",
  "/images/portrait",
  "/images/gallery",
  "/socialLinks",
  "/pressQuotes",
  "/stats/items",
  "/news",
  "/contact/bookingEmail",
  "/contact/bookingUrl",
  "/contact/phone",
  "/spotifyArtistId",
  "/officialSite",
  "/credits/sources",
  "/credits/imageCredits",
];

// --- zod helpers -------------------------------------------------------------
const opt = <T extends z.ZodType>(t: T) => t.nullish();
const link = z.object({ label: z.string(), href: z.string(), external: opt(z.boolean()) });
const anyList = z.array(z.unknown());
const anyObject = z.record(z.string(), z.unknown());
const enumOf = (values: string[] | undefined, fallback: string[]) => {
  const list = values && values.length ? values : fallback;
  return z.enum(list as [string, ...string[]]);
};
const section = (variants: string[] | undefined) => ({ anchorId: opt(z.string()), variant: opt(enumOf(variants, ["default"])) });

export interface CatalogBundle {
  catalog: Catalog;
  componentByFeature: Record<string, CatalogComponentName>;
  requiredFeatureTypes: string[];
  /** Feature types rendered through FeatureSection. */
  extraFeatureTypes: string[];
  allowedStatePaths: string[];
  anchors: Record<string, string>;
  variants: Partial<Record<CatalogComponentName, string[]>>;
}

export function buildCatalog(opts: { union: UnionManifest; brief: DesignBrief; manifest: BriefManifest; featureMap: FeatureMap; lang: "es" | "en" }): CatalogBundle {
  const { union, manifest, featureMap, lang } = opts;
  const v = manifest.variants;
  const componentByFeature: Record<string, CatalogComponentName> = {};
  const extraFeatureTypes: string[] = [];
  for (const type of union.featureTypes) {
    const component = (featureMap.featureTypes[type]?.component ?? featureMap.fallbackComponent) as CatalogComponentName;
    componentByFeature[type] = (CATALOG_COMPONENTS as readonly string[]).includes(component) ? component : "FeatureSection";
    if (componentByFeature[type] === "FeatureSection") extraFeatureTypes.push(type);
  }
  const anchors: Record<string, string> = {};
  for (const type of union.featureTypes) if (type !== "navigation" && type !== "footer") anchors[type] = anchorIdFor(type, lang);

  const bind = (p: string) => `bind with {"$state":"${p}"}`;
  const catalog = defineCatalog(schema, {
    components: {
      Page: {
        props: z.object({ title: z.string(), description: z.string(), lang: z.enum(["es", "en"]) }),
        description: "Root of the page. Its children are the page sections in display order: NavBar first, sections, optional SectionDividers, Footer last.",
      },
      NavBar: {
        props: z.object({ brand: z.string(), links: z.array(link), cta: opt(link), socials: opt(anyList) }),
        description: `Site header/navigation. brand = the artist name from /name. links = 4–6 in-page anchors ("#<anchorId>") to the main sections, labelled in the site language. cta = one primary action. socials: ${bind("/socialLinks")}.`,
      },
      Hero: {
        props: z.object({
          ...section(v.Hero),
          title: z.string(),
          eyebrow: opt(z.string()),
          subtitle: opt(z.string()),
          tagline: opt(z.string()),
          primaryCta: opt(link),
          secondaryCta: opt(link),
          image: opt(anyObject),
          stats: opt(anyList),
          showScrollIndicator: opt(z.boolean()),
        }),
        description: `Opening section. title = the artist name from /name (exactly). subtitle: short line from /shortBio or /tagline. image: ${bind("/images/hero")}. stats: ${bind("/stats/items")}. CTAs link to in-page anchors.`,
      },
      StatsBand: {
        props: z.object({ ...section(v.StatsBand), title: opt(z.string()), eyebrow: opt(z.string()), items: anyList, note: opt(z.string()) }),
        description: `Key career numbers. items: ${bind("/stats/items")} (never write numbers yourself).`,
      },
      Biography: {
        props: z.object({
          ...section(v.Biography),
          title: z.string(),
          eyebrow: opt(z.string()),
          lead: opt(z.string()),
          paragraphs: anyList,
          facts: opt(anyList),
          image: opt(anyObject),
          sourceNote: opt(z.string()),
          maxParagraphs: opt(z.number()),
        }),
        description: `Artist biography. paragraphs: ${bind("/biography/paragraphs")}; facts: ${bind("/biography/facts")}; image: ${bind("/images/portrait")}; sourceNote: ${bind("/biography/sourceNote")}. Omit lead: the hero subtitle already shows /shortBio.`,
      },
      Discography: {
        props: z.object({
          anchorId: opt(z.string()),
          variant: opt(z.string()),
          title: z.string(),
          eyebrow: opt(z.string()),
          intro: opt(z.string()),
          albums: anyList,
          layout: opt(enumOf(v.Discography, ["grid", "list"])),
          limit: opt(z.number()),
          showTypes: opt(z.boolean()),
        }),
        description: `Albums with covers. albums: ${bind("/discography")}. layout chooses the presentation.`,
      },
      TopSongs: {
        props: z.object({ ...section(v.TopSongs), title: z.string(), eyebrow: opt(z.string()), intro: opt(z.string()), songs: anyList, limit: opt(z.number()), showStats: opt(z.boolean()) }),
        description: `Most popular songs with 30-second previews. songs: ${bind("/topSongs")}.`,
      },
      TourDates: {
        props: z.object({
          ...section(v.TourDates),
          title: z.string(),
          eyebrow: opt(z.string()),
          intro: opt(z.string()),
          events: anyList,
          tourName: opt(z.string()),
          ticketsUrl: opt(z.string()),
          emptyTitle: z.string(),
          emptyMessage: z.string(),
          ctaLabel: opt(z.string()),
        }),
        description: `Upcoming concerts. events: ${bind("/tourDates")}; ticketsUrl: ${bind("/tour/ticketsUrl")}. emptyTitle/emptyMessage are shown when there are no dates — never invent dates.`,
      },
      VideoGallery: {
        props: z.object({ ...section(v.VideoGallery), title: z.string(), eyebrow: opt(z.string()), intro: opt(z.string()), videos: anyList, limit: opt(z.number()), channelUrl: opt(z.string()) }),
        description: `Music videos (YouTube). videos: ${bind("/videos")}.`,
      },
      PhotoGallery: {
        props: z.object({ ...section(v.PhotoGallery), title: z.string(), eyebrow: opt(z.string()), images: anyList, limit: opt(z.number()) }),
        description: `Photo gallery. images: ${bind("/images/gallery")}.`,
      },
      MusicPlayer: {
        props: z.object({ ...section(v.MusicPlayer), title: z.string(), eyebrow: opt(z.string()), intro: opt(z.string()), spotifyArtistId: opt(z.string()), links: anyList }),
        description: `Embedded Spotify player + streaming links. spotifyArtistId: ${bind("/spotifyArtistId")}; links: ${bind("/socialLinks")}.`,
      },
      PressQuotes: {
        props: z.object({ ...section(v.PressQuotes), title: z.string(), eyebrow: opt(z.string()), quotes: anyList, limit: opt(z.number()) }),
        description: `Verbatim quotes about the artist with their source. quotes: ${bind("/pressQuotes")}. Never write quotes yourself.`,
      },
      Newsletter: {
        props: z.object({
          ...section(v.Newsletter),
          title: z.string(),
          eyebrow: opt(z.string()),
          body: opt(z.string()),
          placeholder: z.string(),
          buttonLabel: z.string(),
          successMessage: z.string(),
          errorMessage: z.string(),
          privacyNote: opt(z.string()),
        }),
        description: "Newsletter signup form. Write all its texts in the site language, in the voice of the brief.",
      },
      SocialLinks: {
        props: z.object({ ...section(v.SocialLinks), title: z.string(), eyebrow: opt(z.string()), intro: opt(z.string()), links: anyList }),
        description: `Social networks and streaming platforms. links: ${bind("/socialLinks")}.`,
      },
      ContactBooking: {
        props: z.object({
          ...section(v.ContactBooking),
          title: z.string(),
          eyebrow: opt(z.string()),
          body: opt(z.string()),
          email: opt(z.string()),
          bookingUrl: opt(z.string()),
          phone: opt(z.string()),
          links: opt(z.array(link)),
        }),
        description: `Booking / press contact. email: ${bind("/contact/bookingEmail")}; bookingUrl: ${bind("/contact/bookingUrl")}.`,
      },
      FeatureSection: {
        props: z.object({
          ...section(v.FeatureSection),
          featureType: enumOf(extraFeatureTypes, ["other"]),
          title: z.string(),
          eyebrow: opt(z.string()),
          body: opt(z.string()),
          items: opt(z.array(z.object({ title: z.string(), description: opt(z.string()), href: opt(z.string()) }))),
          cta: opt(link),
        }),
        description: `Generic section for extra features found on the inspiration sites (${extraFeatureTypes.join(", ") || "none"}). One per featureType. Items must come from the content (e.g. /news titles) — never invented.`,
      },
      SectionDivider: {
        props: z.object({ label: opt(z.string()), variant: opt(enumOf(v.SectionDivider, ["default"])) }),
        description: "Decorative break between sections (marquee, rule, ornament… depending on the brief). label: a short word or the artist name/alias.",
      },
      Footer: {
        props: z.object({
          brand: z.string(),
          tagline: opt(z.string()),
          links: z.array(link),
          socials: anyList,
          copyright: z.string(),
          credits: z.array(z.string()),
          sources: opt(anyList),
        }),
        description: `Page footer. brand = /name. socials: ${bind("/socialLinks")}; sources: ${bind("/credits/sources")}. credits are filled in automatically.`,
      },
    },
    actions: {},
  }) as unknown as Catalog;

  return {
    catalog,
    componentByFeature,
    requiredFeatureTypes: [...union.featureTypes],
    extraFeatureTypes,
    allowedStatePaths: STATE_PATHS,
    anchors,
    variants: v,
  };
}
