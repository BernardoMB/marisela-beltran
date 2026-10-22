import { createRequire } from "node:module";
import path from "node:path";
import fs from "fs-extra";
import { toHex } from "../generators/color.js";
import { DesignTokensSchema, type DesignTokens } from "../schemas/design-tokens.js";
import { toPosixRelative } from "../utils/file-utils.js";
import { isoTimestamp, type Logger } from "../utils/logger.js";
import { run } from "../utils/shell.js";

/**
 * Wrapper around the chhapify CLI (npm: chhapify) — extracts a complete design system from a URL.
 * Equivalent to `npx chhapify <url> --full --out <dir>`, but executed from the local install so the
 * npm registry is never contacted at run time.
 */

const require = createRequire(import.meta.url);

export interface ChhapifyRun {
  ok: boolean;
  outDir: string;
  /** Output kind → absolute file path. */
  files: Record<string, string>;
  exitCode: number | null;
  error?: string;
  durationMs: number;
  /** Combined stdout/stderr (used to parse the design score). */
  output: string;
}

const OUTPUT_KINDS: Record<string, (name: string) => string> = {
  markdown: (n) => `${n}-design-language.md`,
  tokens: (n) => `${n}-design-tokens.json`,
  tailwind: (n) => `${n}-tailwind.config.js`,
  cssVars: (n) => `${n}-variables.css`,
  preview: (n) => `${n}-preview.html`,
  figma: (n) => `${n}-figma-variables.json`,
  reactTheme: (n) => `${n}-theme.js`,
  shadcn: (n) => `${n}-shadcn-theme.css`,
  wordpress: (n) => `${n}-wordpress-theme.json`,
};

/** Absolute path of chhapify's CLI entry (bin/design-extract.js). */
export function chhapifyBin(): string {
  const pkgJson = require.resolve("chhapify/package.json");
  return path.join(path.dirname(pkgJson), "bin", "design-extract.js");
}

async function collectOutputs(outDir: string, name: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const [kind, fileName] of Object.entries(OUTPUT_KINDS)) {
    const file = path.join(outDir, fileName(name));
    if (await fs.pathExists(file)) files[kind] = file;
  }
  return files;
}

export async function runChhapify(opts: {
  url: string;
  outDir: string;
  name: string;
  extraArgs: string[];
  timeoutMs: number;
  root: string;
  logger: Logger;
}): Promise<ChhapifyRun> {
  const started = Date.now();
  await fs.ensureDir(opts.outDir);
  const args = [chhapifyBin(), opts.url, ...opts.extraArgs, "--out", opts.outDir, "--name", opts.name, "--no-history"];
  const res = await run(process.execPath, args, {
    cwd: opts.root,
    timeoutMs: opts.timeoutMs,
    label: "chhapify",
    logger: opts.logger,
    env: { FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  const files = await collectOutputs(opts.outDir, opts.name);
  const ok = !res.failed && Boolean(files.tokens);
  const tail = res.all
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-4)
    .join(" | ");
  return {
    ok,
    outDir: opts.outDir,
    files,
    exitCode: res.exitCode,
    error: ok ? undefined : res.timedOut ? `timed out after ${Math.round(opts.timeoutMs / 1000)}s` : tail || res.errorMessage || "no tokens produced",
    durationMs: Date.now() - started,
    output: res.all,
  };
}

/** Parse `--name: value;` declarations of the first `:root { … }` block (falls back to all declarations). */
export function parseCssVariables(css: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const rootBlock = css.match(/:root\s*\{([^}]*)\}/);
  const body = rootBlock ? rootBlock[1] : css.replace(/\.dark\s*\{[^}]*\}/g, "");
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

type W3cGroup = Record<string, { $value?: unknown; $type?: string } | undefined>;

function tokenValues(group: unknown): Array<[string, string]> {
  if (!group || typeof group !== "object") return [];
  return Object.entries(group as W3cGroup)
    .filter(([, v]) => v && typeof v === "object" && v.$value !== undefined && v.$value !== null)
    .map(([k, v]) => [k, String(v!.$value)]);
}

const px = (v: string): number | null => {
  const m = v.match(/(-?\d+(?:\.\d+)?)\s*px/);
  if (m) return Number(m[1]);
  const r = v.match(/(-?\d+(?:\.\d+)?)\s*rem/);
  if (r) return Number(r[1]) * 16;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const firstFamily = (v: string): string => v.split(",")[0].replace(/["']/g, "").trim();

/** Parse chhapify's design score from its CLI summary ("Design Score: 72/100 (B)"). */
export function parseDesignScore(output: string): { overall: number; grade: string } | null {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "");
  const m = clean.match(/Design Score:\s*(\d+)\s*\/\s*100\s*\(([A-F][+-]?)\)/);
  return m ? { overall: Number(m[1]), grade: m[2] } : null;
}

/** Normalize chhapify outputs into our DesignTokens schema. Throws if the W3C tokens file is unusable. */
export async function parseChhapifyOutputs(opts: {
  outDir: string;
  name: string;
  url: string;
  slug: string;
  root: string;
  output?: string;
}): Promise<DesignTokens> {
  const files = await collectOutputs(opts.outDir, opts.name);
  if (!files.tokens) throw new Error(`chhapify tokens file missing in ${opts.outDir}`);
  const raw = JSON.parse(await fs.readFile(files.tokens, "utf8")) as Record<string, unknown>;
  const warnings: string[] = [];

  const colorEntries = tokenValues(raw.color);
  const color = (key: string) => toHex(colorEntries.find(([k]) => k === key)?.[1] ?? null);
  const listOf = (prefix: string) =>
    colorEntries
      .filter(([k]) => k.startsWith(prefix))
      .sort(([a], [b]) => Number(a.split("-").pop()) - Number(b.split("-").pop()))
      .map(([, v]) => toHex(v))
      .filter((v): v is string => Boolean(v));

  const shadcn = files.shadcn ? parseCssVariables(await fs.readFile(files.shadcn, "utf8")) : {};
  const primary = color("primary") ?? toHex(shadcn.primary ?? null);
  const secondary = color("secondary") ?? toHex(shadcn.secondary ?? null);
  const accent = color("accent") ?? toHex(shadcn.accent ?? null);
  const backgrounds = listOf("background-");
  const text = listOf("text-");
  const neutrals = listOf("neutral-");
  const palette = [...new Set([primary, secondary, accent, ...backgrounds, ...text, ...neutrals].filter((c): c is string => Boolean(c)))].slice(0, 24);
  if (!primary) warnings.push("no primary brand color detected");

  const fontEntries = tokenValues(raw.fontFamily);
  const heading = fontEntries.find(([k]) => k === "heading")?.[1];
  const body = fontEntries.find(([k]) => k === "body")?.[1];
  const families = [...new Set(fontEntries.map(([, v]) => firstFamily(v)).filter(Boolean))];

  const scalePx = [...new Set(tokenValues(raw.fontSize).map(([, v]) => px(v)).filter((n): n is number => n !== null && n > 0))].sort((a, b) => a - b);
  const spacing = [...new Set(tokenValues(raw.spacing).map(([, v]) => px(v)).filter((n): n is number => n !== null && n >= 0))].sort((a, b) => a - b);
  const radii = [...new Set(tokenValues(raw.borderRadius).map(([, v]) => px(v)).filter((n): n is number => n !== null && n >= 0))].sort((a, b) => a - b);
  const shadows = tokenValues(raw.shadow).map(([, v]) => v).filter(Boolean).slice(0, 12);
  const breakpoints = [...new Set(tokenValues(raw.breakpoint).map(([, v]) => px(v)).filter((n): n is number => n !== null && n > 0))].sort((a, b) => a - b);
  const basePx = spacing.find((n) => n >= 4 && n <= 8) ?? null;

  const relFiles: Record<string, string> = {};
  for (const [kind, file] of Object.entries(files)) relFiles[kind] = toPosixRelative(opts.root, file);

  return DesignTokensSchema.parse({
    schemaVersion: 1,
    slug: opts.slug,
    sourceUrl: opts.url,
    extractor: "chhapify",
    extractedAt: isoTimestamp(),
    colors: { primary, secondary, accent, backgrounds, text, neutrals, palette },
    typography: {
      headingFamily: heading ? firstFamily(heading) : (families[0] ?? null),
      bodyFamily: body ? firstFamily(body) : (families[1] ?? families[0] ?? null),
      families,
      scalePx,
    },
    spacing: { basePx, scalePx: spacing },
    radiiPx: radii,
    shadows,
    breakpointsPx: breakpoints,
    shadcn,
    files: relFiles,
    score: opts.output ? parseDesignScore(opts.output) : null,
    warnings,
  });
}
