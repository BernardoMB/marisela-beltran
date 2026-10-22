import path from "node:path";
import fs from "fs-extra";
import type { Album, ArtistContent, ContentDocument, ImageAsset } from "../schemas/content-schema.js";
import type { DesignBrief, FactoryContext } from "../utils/config.js";
import { coverPlaceholderSvg, heroPlaceholderSvg } from "./placeholder-art.js";
import type { Theme } from "./theme-generator.js";

/**
 * Maps the synthesized artist content into a generated project:
 *  - lib/content.ts (typed `artistContent` export; its object literal is valid JSON)
 *  - public/images/** (downloaded photos and covers, plus brief-styled placeholder art)
 *  - public/images/CREDITS.md
 */

/** Deep-clone the document into the site-facing ArtistContent (drops `meta` and every `localFile`). */
export function toSiteContent(doc: ContentDocument): ArtistContent {
  const { meta: _meta, ...rest } = structuredClone(doc);
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        if (k === "localFile" || v === undefined) continue;
        out[k] = strip(v);
      }
      return out;
    }
    return value;
  };
  return strip(rest) as ArtistContent;
}

/** `lib/content.ts` source. The object literal is plain JSON (the validator parses it back). */
export function renderContentModule(content: ArtistContent): string {
  // U+2028/U+2029 are valid inside string literals since ES2019, so plain JSON is valid TypeScript.
  const json = JSON.stringify(content, null, 2);
  return `// Artist content fetched from public sources by artist-site-factory (see README.md → Content sources).
// Edit freely: every component reads from this object.
import type { ArtistContent } from "@/lib/types";

export const artistContent: ArtistContent = ${json};
`;
}

function* imagesOf(doc: ContentDocument): Generator<ImageAsset> {
  if (doc.images.hero) yield doc.images.hero;
  if (doc.images.portrait) yield doc.images.portrait;
  if (doc.biography.image) yield doc.biography.image;
  for (const g of doc.images.gallery) yield g;
  for (const a of doc.discography) if (a.cover) yield a.cover;
  for (const v of doc.videos) if (v.thumbnail) yield v.thumbnail;
}

export async function injectContent(opts: { ctx: FactoryContext; doc: ContentDocument; projectDir: string; theme: Theme; brief: DesignBrief }): Promise<{ content: ArtistContent; copiedImages: string[]; placeholders: string[] }> {
  const { ctx, doc, projectDir, theme, brief } = opts;
  const publicDir = path.join(projectDir, "public");
  const copiedImages: string[] = [];
  const placeholders: string[] = [];
  const copied = new Set<string>();

  // 1. Copy every downloaded image to public/<src>.
  for (const img of imagesOf(doc)) {
    if (!img.localFile || /^https?:/i.test(img.src) || copied.has(img.src)) continue;
    const from = path.join(ctx.paths.root, img.localFile);
    const to = path.join(publicDir, img.src.replace(/^\//, ""));
    if (await fs.pathExists(from)) {
      await fs.ensureDir(path.dirname(to));
      await fs.copyFile(from, to);
      copied.add(img.src);
      copiedImages.push(img.src);
    }
  }

  const content = toSiteContent(doc);
  const exists = (src: string) => /^https?:/i.test(src) || copied.has(src);

  // 2. Images that failed to copy are dropped; albums without artwork get brief-styled covers.
  const dropMissing = (img: ImageAsset | undefined) => (img && exists(img.src) ? img : undefined);
  content.images.hero = dropMissing(content.images.hero);
  content.images.portrait = dropMissing(content.images.portrait);
  content.biography.image = dropMissing(content.biography.image);
  content.images.gallery = content.images.gallery.filter((g) => exists(g.src));
  const placeholderDir = path.join(publicDir, "images", "placeholders");
  content.discography = await Promise.all(
    content.discography.map(async (album: Album): Promise<Album> => {
      if (album.cover && exists(album.cover.src)) return album;
      const file = `cover-${album.id}.svg`;
      await fs.outputFile(path.join(placeholderDir, file), coverPlaceholderSvg(album.title, album.year, theme, brief), "utf8");
      placeholders.push(`/images/placeholders/${file}`);
      return { ...album, cover: { src: `/images/placeholders/${file}`, alt: album.title, width: 1000, height: 1000, placeholder: true } };
    }),
  );
  if (!content.images.hero) {
    await fs.outputFile(path.join(placeholderDir, "hero.svg"), heroPlaceholderSvg(content.name, theme, brief), "utf8");
    placeholders.push("/images/placeholders/hero.svg");
    content.images.hero = { src: "/images/placeholders/hero.svg", alt: "", width: 1600, height: 1000, placeholder: true };
  }

  // 3. Credits file for every real image.
  const lines = [`# Image credits — ${content.name}`, ""];
  for (const img of [content.images.hero, ...content.images.gallery].filter((i): i is ImageAsset => Boolean(i) && !i!.placeholder)) {
    lines.push(`- \`${img.src}\` — ${img.credit ?? "unknown author"}${img.license ? ` (${img.license})` : ""}${img.sourceUrl ? ` — ${img.sourceUrl}` : ""}`);
  }
  const covers = content.discography.filter((a) => a.cover && !a.cover.placeholder);
  if (covers.length) lines.push("", `Album covers (${covers.length}) © their respective owners, retrieved via Apple Music / Deezer.`);
  if (placeholders.length) lines.push("", `Placeholder artwork (${placeholders.length} files in /images/placeholders) was generated for this site.`);
  await fs.outputFile(path.join(publicDir, "images", "CREDITS.md"), `${lines.join("\n")}\n`, "utf8");

  await fs.outputFile(path.join(projectDir, "lib", "content.ts"), renderContentModule(content), "utf8");
  return { content, copiedImages, placeholders };
}
