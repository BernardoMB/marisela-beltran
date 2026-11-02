import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LinkItem, SocialLink, SocialPlatform } from "@/lib/types";

/** shadcn/ui class combiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** True for absolute http(s) / mailto / tel links. */
export function isExternal(href: string): boolean {
  return /^(https?:)?\/\//i.test(href) || /^(mailto|tel):/i.test(href);
}

/** Props for an <a>: external http links open in a new tab safely. */
export function linkAttrs(href: string): { href: string; target?: "_blank"; rel?: string } {
  if (/^(https?:)?\/\//i.test(href)) return { href, target: "_blank", rel: "noopener noreferrer" };
  return { href };
}

export function linkItemAttrs(link: LinkItem): { href: string; target?: "_blank"; rel?: string } {
  return linkAttrs(link.href);
}

export interface EventDateParts {
  day: string;
  month: string;
  monthShort: string;
  year: string;
  weekday: string;
  weekdayShort: string;
  /** e.g. "sábado, 5 de junio de 2026" */
  full: string;
  /** e.g. "05.06.2026" */
  numeric: string;
}

/** Locale-aware parts of an ISO date (yyyy-mm-dd), computed in UTC so SSR and client agree. */
export function formatEventDate(iso: string, locale: string): EventDateParts {
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  const date = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1, 12));
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...o }).format(date);
  return {
    day: fmt({ day: "2-digit" }),
    month: fmt({ month: "long" }),
    monthShort: fmt({ month: "short" }).replace(".", ""),
    year: fmt({ year: "numeric" }),
    weekday: fmt({ weekday: "long" }),
    weekdayShort: fmt({ weekday: "short" }).replace(".", ""),
    full: fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    numeric: `${String(d || 1).padStart(2, "0")}.${String(m || 1).padStart(2, "0")}.${y || 1970}`,
  };
}

/** 225 → "3:45". */
export function formatDuration(totalSeconds?: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Apply an optional limit to a list. */
export function take<T>(items: T[] | undefined, limit?: number): T[] {
  const list = items ?? [];
  return typeof limit === "number" && limit > 0 ? list.slice(0, limit) : list;
}

/** "Marisela" → "M"; "La Dama de Hierro" → "LD". */
export function initials(text: string, max = 2): string {
  return text
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w))
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, max);
}

/** YouTube thumbnail URL (remote; render with unoptimized images). */
export function youtubeThumbnail(youtubeId: string, quality: "hq" | "maxres" | "mq" = "hq"): string {
  return `https://i.ytimg.com/vi/${youtubeId}/${quality === "maxres" ? "maxresdefault" : quality === "mq" ? "mqdefault" : "hqdefault"}.jpg`;
}

/** Privacy-friendly YouTube embed URL. */
export function youtubeEmbedUrl(youtubeId: string, autoplay = true): string {
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0${autoplay ? "&autoplay=1" : ""}`;
}

/** Spotify artist embed URL (compact player). theme 0 = dark background. */
export function spotifyArtistEmbedUrl(artistId: string, theme: 0 | 1 = 0): string {
  return `https://open.spotify.com/embed/artist/${artistId}?utm_source=generator&theme=${theme}`;
}

const STREAMING: SocialPlatform[] = ["spotify", "apple-music", "deezer", "youtube", "amazon-music", "soundcloud"];

/** Streaming platforms first (in a stable order), then social networks. */
export function sortSocialLinks(links: SocialLink[]): SocialLink[] {
  const order = (p: SocialPlatform) => {
    const i = STREAMING.indexOf(p);
    return i >= 0 ? i : 10 + ["instagram", "tiktok", "facebook", "x", "website", "other"].indexOf(p);
  };
  return [...links].sort((a, b) => order(a.platform) - order(b.platform));
}

export function streamingLinks(links: SocialLink[]): SocialLink[] {
  return links.filter((l) => STREAMING.includes(l.platform));
}

export function socialOnlyLinks(links: SocialLink[]): SocialLink[] {
  return links.filter((l) => !STREAMING.includes(l.platform));
}

/** Basic email check for the newsletter mock. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
