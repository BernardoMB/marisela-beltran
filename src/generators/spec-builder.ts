import type { Spec } from "@json-render/core";
import type { ArtistContent } from "../schemas/content-schema.js";
import type { UnionManifest } from "../schemas/feature-manifest.js";
import type { DesignBrief } from "../utils/config.js";
import { CANONICAL_BINDINGS, type BriefManifest, type CatalogBundle, type CatalogComponentName } from "./component-registry.js";

/**
 * Deterministic json-render spec builder: composes a brief-aware page without an LLM.
 * Section order and microcopy come from config/design-briefs.json; data is bound to the fetched
 * content via $state; layout variants come from the brief manifest. Also used as the fallback that
 * fills any gap left by an LLM-generated spec.
 */

type Lang = "es" | "en";
type Props = Record<string, unknown>;
type Element = { type: string; props: Props; children: string[] };

const FEATURE_TITLES: Record<Lang, Record<string, string>> = {
  es: { merch: "Tienda", "fan-club": "Club de fans", countdown: "Próximamente", news: "Noticias", lyrics: "Canciones y letras" },
  en: { merch: "Store", "fan-club": "Fan club", countdown: "Coming up", news: "News", lyrics: "Songs & lyrics" },
};

const FEATURE_BODY: Record<Lang, Record<string, string>> = {
  es: {
    merch: "Artículos oficiales y novedades, directamente desde los canales de la artista.",
    "fan-club": "Únete a la comunidad: síguela en sus redes y recibe noticias antes que nadie.",
    countdown: "Lo que viene, en un solo lugar.",
    news: "Las novedades más recientes de su sitio oficial.",
    lyrics: "Sus canciones más queridas, para escucharlas y cantarlas.",
  },
  en: {
    merch: "Official merchandise and news, straight from the artist's channels.",
    "fan-club": "Join the community: follow her and get the news first.",
    countdown: "What's next, all in one place.",
    news: "The latest news from her official website.",
    lyrics: "Her most beloved songs, to listen to and sing along.",
  },
};

const NAV_LABELS: Record<Lang, Record<string, string>> = {
  es: { discography: "Discografía", "top-songs": "Canciones", "tour-dates": "Gira", biography: "Biografía", video: "Videos", "music-player": "Escuchar", "press-quotes": "Prensa", contact: "Contacto", "photo-gallery": "Galería", newsletter: "Boletín" },
  en: { discography: "Discography", "top-songs": "Songs", "tour-dates": "Tour", biography: "Biography", video: "Videos", "music-player": "Listen", "press-quotes": "Press", contact: "Contact", "photo-gallery": "Gallery", newsletter: "Newsletter" },
};

const NAV_PRIORITY = ["discography", "top-songs", "tour-dates", "biography", "video", "music-player", "press-quotes", "photo-gallery", "contact"];

const comparable = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The biography lead (the summary), unless the page already shows that text: as the hero subtitle
 * (/shortBio), or at the start of the first paragraph (e.g. both came from the Wikipedia intro).
 */
export function leadFor(content: ArtistContent): string | undefined {
  const lead = content.biography.summary;
  if (!lead || comparable(lead) === comparable(content.shortBio)) return undefined;
  const first = content.biography.paragraphs[0];
  if (!first) return lead;
  return comparable(first).startsWith(comparable(lead).slice(0, 60)) ? undefined : lead;
}

/** Resolve {name}/{alias}/{debutYear}; drop " · "-separated segments that cannot resolve. */
export function resolveCopyTokens(text: string, content: ArtistContent): string | null {
  const values: Record<string, string | undefined> = {
    name: content.name,
    alias: content.aliases[0],
    debutYear: content.biography.debutYear ? String(content.biography.debutYear) : undefined,
  };
  const segments = text.split(" · ").map((segment) => {
    let ok = true;
    const out = segment.replace(/\{(\w+)\}/g, (_, key: string) => {
      const v = values[key];
      if (!v) ok = false;
      return v ?? "";
    });
    return ok ? out.trim() : null;
  });
  const kept = segments.filter((s): s is string => Boolean(s));
  return kept.length ? kept.join(" · ") : null;
}

export const bindState = (path: string) => ({ $state: path });

/** Value at a JSON pointer inside the content object. */
export function getByPointer(obj: unknown, pointer: string): unknown {
  let cur: unknown = obj;
  for (const seg of pointer.split("/").filter(Boolean)) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/** Order the union's feature types by the brief's preferred order (unknown types before newsletter). */
export function orderFeatureTypes(brief: DesignBrief, featureTypes: string[]): string[] {
  const body = featureTypes.filter((t) => t !== "navigation" && t !== "footer");
  const ordered = brief.sectionOrder.filter((t) => body.includes(t));
  const missing = body.filter((t) => !ordered.includes(t));
  const anchor = ordered.indexOf("newsletter");
  if (anchor >= 0) ordered.splice(anchor, 0, ...missing);
  else ordered.push(...missing);
  return ordered;
}

export function navLinks(order: string[], bundle: CatalogBundle, lang: Lang): Array<{ label: string; href: string }> {
  return NAV_PRIORITY.filter((t) => order.includes(t))
    .slice(0, 6)
    .map((t) => ({ label: NAV_LABELS[lang][t] ?? t, href: `#${bundle.anchors[t]}` }));
}

export function footerCredits(content: ArtistContent): string[] {
  return [content.biography.sourceNote, ...content.credits.imageCredits, content.credits.disclaimer].filter((s): s is string => Boolean(s));
}

function firstListen(content: ArtistContent): string | undefined {
  return content.socialLinks.find((l) => l.platform === "spotify")?.href ?? content.socialLinks.find((l) => ["apple-music", "deezer", "youtube"].includes(l.platform))?.href;
}

function featureItems(type: string, content: ArtistContent, lang: Lang): Array<{ title: string; description?: string; href?: string }> {
  switch (type) {
    case "news":
      return content.news.slice(0, 4).map((n) => ({ title: n.title, description: n.date, href: n.href }));
    case "fan-club":
      return content.socialLinks
        .filter((l) => ["instagram", "facebook", "tiktok", "x", "youtube"].includes(l.platform))
        .slice(0, 4)
        .map((l) => ({ title: l.label, description: l.handle, href: l.href }));
    case "countdown": {
      const next = content.tourDates[0];
      if (next) return [{ title: `${next.venue} — ${next.city}`, description: next.date, href: next.ticketUrl }];
      const latest = [...content.discography].reverse().find((a) => a.year);
      return latest ? [{ title: latest.title, description: String(latest.year), href: latest.links.spotify ?? latest.links.appleMusic ?? latest.links.deezer }] : [];
    }
    case "lyrics":
      return content.topSongs.slice(0, 6).map((s) => ({ title: s.title, description: s.album, href: s.links.spotify ?? s.links.deezer ?? s.links.appleMusic }));
    case "merch":
      return [];
    default:
      return lang === "es" ? [] : [];
  }
}

/** Build a complete, valid spec for the brief without an LLM. */
export function buildDeterministicSpec(opts: { brief: DesignBrief; bundle: CatalogBundle; manifest: BriefManifest; union: UnionManifest; content: ArtistContent; lang: Lang }): Spec {
  const { brief, bundle, manifest, union, content, lang } = opts;
  const copy = brief.copy[lang] as Record<string, Record<string, string>>;
  const c = (key: string, field: string): string | undefined => {
    const raw = copy[key]?.[field];
    return raw ? (resolveCopyTokens(raw, content) ?? undefined) : undefined;
  };
  const variantOf = (component: CatalogComponentName) => manifest.variants[component]?.[0];
  const order = orderFeatureTypes(brief, union.featureTypes);
  const elements: Record<string, Element> = {};
  const children: string[] = [];
  const listen = firstListen(content);

  const bound = (component: CatalogComponentName): Props => {
    const out: Props = {};
    for (const [prop, path] of Object.entries(CANONICAL_BINDINGS[component] ?? {})) {
      if (getByPointer(content, path) !== undefined) out[prop] = bindState(path);
    }
    return out;
  };
  const anchorOf = (type: string) => bundle.anchors[type];
  const has = (type: string) => order.includes(type);

  elements.nav = {
    type: "NavBar",
    props: {
      brand: content.name,
      links: navLinks(order, bundle, lang),
      ...(listen ? { cta: { label: c("nav", "cta") ?? (lang === "es" ? "Escuchar" : "Listen"), href: has("music-player") ? `#${anchorOf("music-player")}` : listen } } : {}),
      ...bound("NavBar"),
    },
    children: [],
  };

  for (const type of order) {
    const component = bundle.componentByFeature[type] ?? "FeatureSection";
    const key = elements[type] ? `${type}-2` : type;
    const base: Props = { anchorId: anchorOf(type), ...bound(component) };
    let props: Props;
    switch (component) {
      case "Hero":
        props = {
          ...base,
          variant: variantOf("Hero"),
          title: content.name,
          eyebrow: c("hero", "eyebrow"),
          subtitle: content.shortBio,
          tagline: content.tagline,
          primaryCta: { label: c("hero", "primaryCta") ?? (lang === "es" ? "Escuchar" : "Listen"), href: has("music-player") ? `#${anchorOf("music-player")}` : has("top-songs") ? `#${anchorOf("top-songs")}` : (listen ?? "#") },
          secondaryCta: has("tour-dates") ? { label: c("hero", "secondaryCta") ?? (lang === "es" ? "Gira" : "Tour"), href: `#${anchorOf("tour-dates")}` } : undefined,
          showScrollIndicator: true,
        };
        break;
      case "StatsBand":
        props = { ...base, variant: variantOf("StatsBand"), title: c("stats", "title"), eyebrow: c("stats", "eyebrow") };
        break;
      case "Biography":
        props = { ...base, variant: variantOf("Biography"), title: c("biography", "title") ?? "Biografía", eyebrow: c("biography", "eyebrow"), lead: leadFor(content), maxParagraphs: 3 };
        break;
      case "Discography":
        props = { ...base, title: c("discography", "title") ?? "Discografía", eyebrow: c("discography", "eyebrow"), intro: c("discography", "intro"), layout: manifest.variants.Discography?.[0] ?? "grid", showTypes: true };
        break;
      case "TopSongs":
        props = { ...base, variant: variantOf("TopSongs"), title: c("top-songs", "title") ?? "Canciones", eyebrow: c("top-songs", "eyebrow"), intro: c("top-songs", "intro"), limit: 10, showStats: true };
        break;
      case "TourDates":
        props = {
          ...base,
          variant: variantOf("TourDates"),
          title: c("tour-dates", "title") ?? "Gira",
          eyebrow: c("tour-dates", "eyebrow"),
          emptyTitle: c("tour-dates", "emptyTitle") ?? (lang === "es" ? "Próximas fechas por anunciar" : "Dates to be announced"),
          emptyMessage: c("tour-dates", "emptyMessage") ?? (lang === "es" ? "Suscríbete para enterarte primero." : "Subscribe to hear first."),
          ctaLabel: c("tour-dates", "ctaLabel"),
        };
        break;
      case "VideoGallery":
        props = { ...base, variant: variantOf("VideoGallery"), title: c("video", "title") ?? "Videos", eyebrow: c("video", "eyebrow"), limit: 6 };
        break;
      case "PhotoGallery":
        props = { ...base, variant: variantOf("PhotoGallery"), title: c("photo-gallery", "title") ?? (lang === "es" ? "Galería" : "Gallery"), eyebrow: c("photo-gallery", "eyebrow") };
        break;
      case "MusicPlayer":
        props = { ...base, variant: variantOf("MusicPlayer"), title: c("music-player", "title") ?? (lang === "es" ? "Escucha" : "Listen"), eyebrow: c("music-player", "eyebrow"), intro: c("music-player", "intro") };
        break;
      case "PressQuotes":
        props = { ...base, variant: variantOf("PressQuotes"), title: c("press-quotes", "title") ?? (lang === "es" ? "Prensa" : "Press"), eyebrow: c("press-quotes", "eyebrow"), limit: 6 };
        break;
      case "Newsletter":
        props = {
          ...base,
          variant: variantOf("Newsletter"),
          title: c("newsletter", "title") ?? (lang === "es" ? "Boletín" : "Newsletter"),
          eyebrow: c("newsletter", "eyebrow"),
          body: c("newsletter", "body"),
          placeholder: c("newsletter", "placeholder") ?? (lang === "es" ? "tu@correo.com" : "you@email.com"),
          buttonLabel: c("newsletter", "buttonLabel") ?? (lang === "es" ? "Suscribirme" : "Subscribe"),
          successMessage: c("newsletter", "successMessage") ?? (lang === "es" ? "¡Gracias por suscribirte!" : "Thanks for subscribing!"),
          errorMessage: c("newsletter", "errorMessage") ?? (lang === "es" ? "Escribe un correo válido." : "Please enter a valid email."),
          privacyNote: c("newsletter", "privacyNote"),
        };
        break;
      case "SocialLinks":
        props = { ...base, variant: variantOf("SocialLinks"), title: c("social-links", "title") ?? (lang === "es" ? "Redes" : "Social"), eyebrow: c("social-links", "eyebrow") };
        break;
      case "ContactBooking":
        props = {
          ...base,
          variant: variantOf("ContactBooking"),
          title: c("contact", "title") ?? (lang === "es" ? "Contrataciones" : "Booking"),
          eyebrow: c("contact", "eyebrow"),
          body: c("contact", "body"),
          links: content.officialSite ? [{ label: lang === "es" ? "Sitio oficial" : "Official website", href: content.officialSite, external: true }] : undefined,
        };
        break;
      default: {
        const items = featureItems(type, content, lang);
        const ctaHref =
          type === "merch" || type === "news" ? content.officialSite : type === "fan-club" ? `#${anchorOf("newsletter") ?? "boletin"}` : type === "countdown" ? (content.tour.ticketsUrl ?? listen) : listen;
        props = {
          anchorId: anchorOf(type),
          variant: variantOf("FeatureSection"),
          featureType: type,
          title: FEATURE_TITLES[lang][type] ?? c("feature", "title") ?? type,
          eyebrow: c("feature", "eyebrow"),
          body: FEATURE_BODY[lang][type],
          items,
          cta: ctaHref ? { label: c("feature", "ctaLabel") ?? (lang === "es" ? "Ver más" : "See more"), href: ctaHref } : undefined,
        };
      }
    }
    elements[key] = { type: component, props: stripUndefined(props), children: [] };
    children.push(key);
    if (brief.dividers.after.includes(type)) {
      const dKey = `divider-${children.length}`;
      elements[dKey] = {
        type: "SectionDivider",
        props: stripUndefined({ label: content.aliases[0] ?? content.name, variant: manifest.variants.SectionDivider?.includes(brief.dividers.variant) ? brief.dividers.variant : manifest.variants.SectionDivider?.[0] }),
        children: [],
      };
      children.push(dKey);
    }
  }

  const year = new Date().getFullYear();
  elements.footer = {
    type: "Footer",
    props: stripUndefined({
      brand: content.name,
      tagline: content.tagline,
      links: navLinks(order, bundle, lang),
      ...bound("Footer"),
      socials: bindState("/socialLinks"),
      copyright: `${copy.footer?.copyrightPrefix ?? "©"} ${year} ${content.name}`,
      credits: footerCredits(content),
    }),
    children: [],
  };
  elements.page = {
    type: "Page",
    props: { title: `${content.name} — ${content.tagline}`, description: content.shortBio, lang },
    children: ["nav", ...children, "footer"],
  };
  return { root: "page", elements } as unknown as Spec;
}

export function stripUndefined(props: Props): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) if (v !== undefined && v !== null) out[k] = v;
  return out;
}
