import path from "node:path";
import * as cheerio from "cheerio";
import fs from "fs-extra";

/**
 * Small HTTP / text toolkit shared by the content providers.
 * Global `fetch` with timeouts, retries on transient errors, polite rate limiting, text normalization
 * (accent-insensitive matching) and image dimension sniffing (no extra dependencies).
 */

export const USER_AGENT = "artist-site-factory/1.0 (automated artist-site research; contact via repository owner)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
    this.status = status;
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  retries?: number;
  /** Use a browser-like User-Agent (some sites reject bots). */
  browserUA?: boolean;
}

async function doFetch(url: string, opts: FetchOptions): Promise<Response> {
  const retries = opts.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": opts.browserUA ? BROWSER_UA : USER_AGENT, "Accept-Language": "es-MX,es;q=0.9,en;q=0.8", ...opts.headers },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
        redirect: "follow",
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new HttpError(res.status, url);
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new HttpError(res.status, url);
      return res;
    } catch (err) {
      lastErr = err;
      if (err instanceof HttpError && err.status < 500 && err.status !== 429) throw err;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  return (await doFetch(url, opts)).text();
}

export async function fetchJson<T = unknown>(url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await doFetch(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
  return (await res.json()) as T;
}

export async function fetchBuffer(url: string, opts: FetchOptions = {}): Promise<Buffer> {
  const res = await doFetch(url, opts);
  return Buffer.from(await res.arrayBuffer());
}

/** Returns a function that resolves no sooner than `minIntervalMs` after the previous call. */
export function createRateLimiter(minIntervalMs: number): () => Promise<void> {
  let next = 0;
  return async () => {
    const now = Date.now();
    const wait = Math.max(0, next - now);
    next = Math.max(now, next) + minIntervalMs;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  };
}

/** Fold one character: lowercase, accents removed, always exactly one output char (keeps indices aligned). */
function foldChar(c: string): string {
  const base = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (base.length === 1) return base;
  if (/[“”«»„]/.test(c)) return '"';
  if (/[‘’´`]/.test(c)) return "'";
  return base.charAt(0) || " ";
}

/** Lowercase, accent-free text with the SAME length as the input (for snippet extraction). */
export function foldText(text: string): string {
  let out = "";
  for (const c of text) out += foldChar(c).padEnd(c.length, " ").slice(0, c.length);
  return out.replace(/\s/g, " ");
}

/** Lowercase, accent-free, collapsed whitespace — for equality-style matching. */
export function normalizeText(text: string): string {
  return foldText(text).replace(/\s+/g, " ").trim();
}

/** Compare titles ignoring case, accents, punctuation and bracketed suffixes ("(Remastered)"). */
export function titleKey(title: string): string {
  return normalizeText(title)
    .replace(/\s*[([].*?[)\]]\s*/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Collapse whitespace and decode entities of an HTML fragment into plain text. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, svg").remove();
  return $.root().text().replace(/\s+/g, " ").trim();
}

/** Split prose into sentences (keeps the terminal punctuation). */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Group sentences into paragraphs of ~`target` characters. */
export function paragraphsFromText(text: string, target = 520): string[] {
  const out: string[] = [];
  let current = "";
  for (const sentence of splitSentences(text)) {
    if (current && current.length + sentence.length > target) {
      out.push(current.trim());
      current = "";
    }
    current += `${sentence} `;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export interface ImageSize {
  width: number;
  height: number;
  type: "jpeg" | "png" | "webp" | "gif";
}

/** Read image dimensions from a file header (JPEG, PNG, WebP, GIF). */
export function imageSize(buf: Buffer): ImageSize | null {
  if (buf.length < 24) return null;
  // PNG
  if (buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), type: "png" };
  // GIF
  if (buf.toString("ascii", 0, 3) === "GIF") return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), type: "gif" };
  // WebP
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), type: "webp" };
    if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, type: "webp" };
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff), type: "webp" };
    }
    return null;
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7), type: "jpeg" };
      }
      const len = buf.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  }
  return null;
}

/** Download an image (skips existing files) and return its real dimensions. */
export async function downloadImage(url: string, file: string, opts: FetchOptions = {}): Promise<ImageSize | null> {
  if (await fs.pathExists(file)) {
    return imageSize(await fs.readFile(file));
  }
  const buf = await fetchBuffer(url, { timeoutMs: 30_000, ...opts });
  const size = imageSize(buf);
  if (!size) return null;
  await fs.ensureDir(path.dirname(file));
  await fs.writeFile(file, buf);
  return size;
}
