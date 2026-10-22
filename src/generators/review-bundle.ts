import type { ArtistContent } from "../schemas/content-schema.js";
import { getByPointer } from "./spec-builder.js";

/**
 * Text rendering of a generated page for site-facelift's AI review. The review prompt was written for
 * a built site; handing Claude the whole Next.js project made it explore every source file and image
 * (minutes per site). This renders exactly what the page shows — every heading, paragraph, label,
 * list item and image (path + alt text) in page order, with the file each text comes from — into one
 * small markdown file the review can read in a single pass.
 */

type Element = { type: string; props: Record<string, unknown>; children: string[] };
type FlatSpec = { root: string; elements: Record<string, Element> };

/** Props that configure a component but are not visible text. */
const HIDDEN_PROPS = new Set(["anchorId", "variant", "layout", "limit", "maxParagraphs", "showStats", "showTypes", "showScrollIndicator", "align", "featureType", "lang"]);
/** Keys of data items that are identifiers or machine values, not visible text. */
const HIDDEN_KEYS = new Set(["id", "slug", "previewUrl", "sourceUrl", "localFile", "width", "height", "placeholder", "spotifyId", "youtubeId", "isrc", "rank", "durationSec", "links", "external", "platform", "type", "status", "lat", "lng"]);

interface ImageLike {
  src: string;
  alt?: string;
  credit?: string;
}

function isImage(v: unknown): v is ImageLike {
  return typeof v === "object" && v !== null && typeof (v as { src?: unknown }).src === "string";
}

function isLink(v: unknown): v is { label: string; href: string } {
  return typeof v === "object" && v !== null && typeof (v as { label?: unknown }).label === "string" && typeof (v as { href?: unknown }).href === "string";
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

class Renderer {
  readonly out: string[] = [];
  readonly images = new Map<string, string[]>();

  constructor(private readonly content: ArtistContent) {}

  /** Replace `{ $state: "/pointer" }` bindings (at any depth) with the content they point to. */
  resolve(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => this.resolve(v));
    if (value && typeof value === "object") {
      const pointer = (value as { $state?: unknown }).$state;
      if (typeof pointer === "string") return getByPointer(this.content, pointer);
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.resolve(v)]));
    }
    return value;
  }

  image(img: ImageLike, where: string): string {
    const list = this.images.get(img.src) ?? [];
    list.push(where);
    this.images.set(img.src, list);
    return `[image ${img.src}] alt="${oneLine(img.alt ?? "")}"${img.credit ? ` credit="${oneLine(img.credit)}"` : ""}`;
  }

  /** One list line for a data item (album, song, quote, video, event, stat, link…). */
  item(value: unknown, where: string): string {
    if (typeof value === "string") return oneLine(value);
    if (typeof value === "number") return String(value);
    if (isImage(value)) return this.image(value, where);
    if (isLink(value)) return `"${oneLine(value.label)}" → ${value.href}`;
    if (!value || typeof value !== "object") return "";
    const parts: string[] = [];
    for (const [key, v] of Object.entries(value)) {
      if (HIDDEN_KEYS.has(key) || v === undefined || v === null || v === "") continue;
      if (typeof v === "string") parts.push(key === "title" || key === "name" || key === "label" ? `"${oneLine(v)}"` : `${key}: ${oneLine(v)}`);
      else if (typeof v === "number") parts.push(`${key}: ${v}`);
      else if (isImage(v)) parts.push(this.image(v, `${where} ${key}`));
      else if (Array.isArray(v) && v.every((x) => typeof x === "string")) parts.push(`${key}: ${v.join(", ")}`);
    }
    return parts.join(" · ");
  }

  prop(label: string, value: unknown, where: string, source: string): void {
    if (value === undefined || value === null || value === "" || typeof value === "boolean") return;
    const tag = source ? ` (${source})` : "";
    if (typeof value === "string" || typeof value === "number") {
      this.out.push(`- ${label}${tag}: ${oneLine(String(value))}`);
    } else if (isImage(value)) {
      this.out.push(`- ${label}${tag}: ${this.image(value, `${where} ${label}`)}`);
    } else if (isLink(value)) {
      this.out.push(`- ${label}${tag}: "${oneLine(value.label)}" → ${value.href}`);
    } else if (Array.isArray(value)) {
      if (!value.length) {
        this.out.push(`- ${label}${tag}: (none — the section shows its empty state)`);
        return;
      }
      this.out.push(`- ${label}${tag}:`);
      value.forEach((v, i) => {
        const line = this.item(v, `${where} ${label}[${i + 1}]`);
        if (line) this.out.push(`  ${i + 1}. ${line}`);
      });
    } else if (typeof value === "object") {
      this.out.push(`- ${label}${tag}:`);
      for (const [k, v] of Object.entries(value)) {
        if (HIDDEN_KEYS.has(k)) continue;
        const line = Array.isArray(v) ? v.map((x, i) => this.item(x, `${where} ${label}.${k}[${i + 1}]`)).filter(Boolean).join(" | ") : this.item(v, `${where} ${label}.${k}`);
        if (line) this.out.push(`  - ${k}: ${line}`);
      }
    }
  }
}

export function renderReviewBundle(opts: { spec: FlatSpec; content: ArtistContent; projectName: string; briefName: string }): string {
  const { spec, content } = opts;
  const r = new Renderer(content);
  const page = spec.elements[spec.root];
  r.out.push(
    `# ${opts.projectName} — text rendering for review`,
    "",
    `A one-page website for the singer ${content.name} (design: ${opts.briefName}). This file lists everything the page shows,`,
    "section by section in page order: headings, body text, button and link labels, list items and images (file path + alt text).",
    "Lines tagged (content …) come from lib/content.ts — artist information fetched from public sources; untagged lines are page copy",
    "from lib/ui-spec.json. Short interface labels such as \"Leer más\" or \"Boletos\" come from lib/i18n.ts and are not listed.",
    "",
  );
  if (page) {
    r.out.push("## Page metadata", "");
    for (const [k, v] of Object.entries(page.props)) if (!HIDDEN_PROPS.has(k)) r.prop(k, r.resolve(v), "Page", "");
    r.out.push("");
  }
  const order = page?.children ?? Object.keys(spec.elements).filter((k) => k !== spec.root);
  for (const key of order) {
    const el = spec.elements[key];
    if (!el) continue;
    const anchor = typeof el.props.anchorId === "string" ? ` (#${el.props.anchorId})` : "";
    const feature = typeof el.props.featureType === "string" ? ` — ${el.props.featureType}` : "";
    r.out.push(`## ${el.type}${feature}${anchor}`, "");
    for (const [prop, raw] of Object.entries(el.props)) {
      if (HIDDEN_PROPS.has(prop)) continue;
      const pointer = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as { $state?: unknown }).$state : undefined;
      r.prop(prop, r.resolve(raw), el.type, typeof pointer === "string" ? `content ${pointer}` : "");
    }
    r.out.push("");
  }
  r.out.push("## Image index", "", "Every image file and where it appears on the page:", "");
  for (const [src, where] of [...r.images.entries()].sort((a, b) => b[1].length - a[1].length)) {
    r.out.push(`- ${src} — ${where.length}× (${where.join("; ")})`);
  }
  return `${r.out.join("\n")}\n`;
}
