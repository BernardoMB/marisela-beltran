import crypto from "node:crypto";
import path from "node:path";
import fs from "fs-extra";
import type { z } from "zod";

/** Read and parse a JSON file. Throws with the file path on parse errors. */
export async function readJson<T = unknown>(file: string): Promise<T> {
  const raw = await fs.readFile(file, "utf8");
  try {
    return JSON.parse(raw.replace(/^﻿/, "")) as T;
  } catch (err) {
    throw new Error(`Invalid JSON in ${file}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Read a JSON file and validate it with a Zod schema. */
export async function readJsonValidated<S extends z.ZodType>(file: string, schema: S): Promise<z.infer<S>> {
  const data = await readJson(file);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Schema validation failed for ${file}: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Read JSON if the file exists, otherwise return `fallback`. */
export async function readJsonIfExists<T>(file: string, fallback: T): Promise<T> {
  if (!(await fs.pathExists(file))) return fallback;
  return readJson<T>(file);
}

/** Atomically write pretty JSON (write temp file, then rename). Creates parent dirs. */
export async function writeJson(file: string, data: unknown): Promise<void> {
  await writeFileAtomic(file, `${JSON.stringify(data, null, 2)}\n`);
}

/** Atomically write text (UTF-8, LF). Creates parent dirs. */
export async function writeFileAtomic(file: string, content: string | Buffer): Promise<void> {
  await fs.ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(tmp, content);
  try {
    await fs.rename(tmp, file);
  } catch {
    // Windows can refuse rename over a file held open by antivirus/indexers; fall back to copy.
    await fs.copyFile(tmp, file);
    await fs.remove(tmp);
  }
}

/** Write text, creating parent directories (non-atomic, for generated project files). */
export async function writeText(file: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(file));
  await fs.writeFile(file, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

/** sha1 hex digest of a string or buffer. */
export function sha1(input: string | Buffer): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

/** Short stable hash (first 10 hex chars of sha1). */
export function shortHash(input: string | Buffer): string {
  return sha1(input).slice(0, 10);
}

/** Lowercase kebab-case slug of arbitrary text (accents stripped). */
export function slugify(text: string, maxLength = 60): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "item";
}

/**
 * Stable slug for an inspirational URL: host + path, e.g.
 * "https://www.artist1.com/home?x=1" → "artist1-com-home".
 */
export function slugifyUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const pathPart = u.pathname.replace(/\/+$/, "");
    return slugify(`${host}${pathPart}`, 80);
  } catch {
    return slugify(url, 80);
  }
}

/** List files (not directories) under `dir`, recursively, as absolute paths. */
export async function listFilesRecursive(dir: string, filter?: (file: string) => boolean): Promise<string[]> {
  if (!(await fs.pathExists(dir))) return [];
  const out: string[] = [];
  const walk = async (current: string): Promise<void> => {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
        await walk(full);
      } else if (!filter || filter(full)) {
        out.push(full);
      }
    }
  };
  await walk(dir);
  return out.sort();
}

/** Copy a directory recursively (overwrite). */
export async function copyDir(src: string, dest: string, filter?: (src: string) => boolean): Promise<void> {
  await fs.ensureDir(dest);
  await fs.copy(src, dest, { overwrite: true, filter: filter ?? (() => true) });
}

/** Path relative to `root` with forward slashes (for logs and manifests). */
export function toPosixRelative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

/** Deterministic PRNG (mulberry32) seeded from a string — used for reproducible "random" choices. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Format a byte count, e.g. 1536 → "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/** Format milliseconds, e.g. 83000 → "1m 23s". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}
