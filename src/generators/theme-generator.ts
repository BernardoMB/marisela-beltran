import type { DesignTokens } from "../schemas/design-tokens.js";
import type { DesignBrief, FontSpec } from "../utils/config.js";
import {
  contrastRatio,
  deltaE,
  ensureContrast,
  hexToHsl,
  hsl,
  hueDistance,
  isChromatic,
  isHex,
  mix,
  mostReadable,
  normalizeHue,
  rgbChannels,
  toHex,
  withAlpha,
} from "./color.js";

/**
 * Theme generator: turns the design tokens extracted (by chhapify) from ONE inspirational site
 * into a brief-specific palette, typography and shape system, guaranteeing:
 *   - the palette is derived from the extracted tokens (base hue / saturation / secondary hue), but
 *   - transformed by the brief's strategy so the six sites never share a palette, and
 *   - WCAG contrast: body text ≥ 7:1 where possible (≥ 4.5 always), accents ≥ 4.5 on the background.
 *
 * CSS custom property contract (every brief's components may rely on ALL of these):
 *   --background --foreground --surface --surface-foreground --muted --muted-foreground
 *   --primary --primary-foreground --secondary --secondary-foreground --accent --accent-foreground
 *   --border --ring --input --card --card-foreground --popover --popover-foreground
 *   --destructive --destructive-foreground
 *   --gradient-from --gradient-via --gradient-to --glow --overlay
 *   --radius --radius-sm --radius-lg --shadow-sm --shadow-md --shadow-lg --shadow-color
 *   --container-max --section-space --grain-opacity --glass-bg --glass-border --glass-blur
 *   --font-display --font-body --font-mono  (font vars are set on <html> by next/font in layout.tsx)
 */

export interface ThemePalette {
  background: string;
  foreground: string;
  surface: string;
  surfaceForeground: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  ring: string;
  input: string;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  glow: string;
  overlay: string;
  destructive: string;
  destructiveForeground: string;
}

export interface Theme {
  briefId: string;
  briefName: string;
  mode: "light" | "dark";
  strategy: string;
  source: { slug: string; url: string | null; extractor: DesignTokens["extractor"] };
  /** Hue taken from the inspiration tokens (or the brief fallback). */
  baseHue: number;
  baseColor: string | null;
  secondaryHue: number | null;
  palette: ThemePalette;
  /** CSS custom properties without the leading `--`. */
  vars: Record<string, string>;
  fonts: { display: FontSpec; body: FontSpec; mono: FontSpec | null };
  radius: { base: number; sm: number; lg: number };
  shadows: { sm: string; md: string; lg: string };
  containerMax: number;
  motion: DesignBrief["motion"];
  contrast: {
    foregroundOnBackground: number;
    mutedOnBackground: number;
    primaryOnBackground: number;
    accentOnBackground: number;
    primaryForegroundOnPrimary: number;
  };
  /** Inspiration font families (for the report; the brief's fonts are what ship). */
  inspirationFonts: string[];
}

interface BaseColors {
  baseColor: string | null;
  hue: number;
  sat: number;
  secondaryHue: number | null;
}

/** Choose the brand-carrying color(s) from the extracted tokens. */
export function pickBaseColors(tokens: DesignTokens, fallbackHue: number): BaseColors {
  const shadcnPrimary = toHex(tokens.shadcn.primary ?? null);
  const candidates = [
    tokens.colors.primary,
    tokens.colors.accent,
    shadcnPrimary,
    tokens.colors.secondary,
    ...tokens.colors.palette,
  ].filter((c): c is string => isHex(c));
  const chromatic = candidates.filter((c) => isChromatic(c));
  const base = chromatic[0] ?? null;
  const baseHsl = base ? hexToHsl(base) : null;
  const hue = baseHsl ? baseHsl.h : normalizeHue(fallbackHue);
  const sat = baseHsl ? baseHsl.s : 0.5;
  const second = chromatic.find((c) => hueDistance(hexToHsl(c).h, hue) >= 30);
  return { baseColor: base, hue, sat, secondaryHue: second ? hexToHsl(second).h : null };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function readableOn(bg: string, light: string, dark: string): string {
  return contrastRatio(light, bg) >= contrastRatio(dark, bg) ? light : dark;
}

function buildPalette(brief: DesignBrief, base: BaseColors): ThemePalette {
  const H = base.hue;
  const S = base.sat;
  const strategy = brief.palette.strategy;
  const p = brief.palette as Record<string, unknown>;

  switch (strategy) {
    case "monochrome": {
      const cap = typeof p.saturationCap === "number" ? p.saturationCap : 0.12;
      const background = hsl(H, Math.min(S, cap) * 0.35, 0.985);
      const foreground = ensureContrast(hsl(H, 0.08, 0.09), background, 12);
      const accent = ensureContrast(hsl(H, clamp(S, 0.18, 0.38), 0.38), background, 4.8);
      return {
        background,
        foreground,
        surface: hsl(H, 0.05, 0.962),
        surfaceForeground: foreground,
        muted: hsl(H, 0.05, 0.935),
        mutedForeground: ensureContrast(hsl(H, 0.06, 0.4), background, 5.5),
        primary: foreground,
        primaryForeground: background,
        secondary: hsl(H, 0.05, 0.905),
        secondaryForeground: foreground,
        accent,
        accentForeground: readableOn(accent, background, foreground),
        border: hsl(H, 0.05, 0.87),
        ring: foreground,
        input: hsl(H, 0.05, 0.82),
        gradientFrom: background,
        gradientVia: hsl(H, 0.05, 0.955),
        gradientTo: hsl(H, 0.06, 0.92),
        glow: withAlpha(foreground, 0.06),
        overlay: withAlpha(foreground, 0.35),
        destructive: "#b42318",
        destructiveForeground: "#ffffff",
      };
    }

    case "vibrant": {
      const rot = Array.isArray(p.hueRotation) ? (p.hueRotation as number[]) : [0, 150, 60];
      const H2 = base.secondaryHue ?? normalizeHue(H + (rot[1] ?? 150));
      const H3 = normalizeHue(H + (rot[2] ?? 60));
      const background = hsl(H, 0.55, 0.07);
      const foreground = ensureContrast(hsl(H, 0.25, 0.97), background, 15);
      const primary = ensureContrast(hsl(H, 0.95, 0.6), background, 5);
      const secondary = ensureContrast(hsl(H2, 0.95, 0.6), background, 5);
      const accent = ensureContrast(hsl(H3, 1, 0.62), background, 6);
      const ink = hsl(H, 0.6, 0.06);
      return {
        background,
        foreground,
        surface: hsl(H, 0.45, 0.12),
        surfaceForeground: foreground,
        muted: hsl(H, 0.35, 0.17),
        mutedForeground: ensureContrast(hsl(H, 0.2, 0.74), background, 7),
        primary,
        primaryForeground: readableOn(primary, foreground, ink),
        secondary,
        secondaryForeground: readableOn(secondary, foreground, ink),
        accent,
        accentForeground: readableOn(accent, foreground, ink),
        border: hsl(H, 0.35, 0.24),
        ring: accent,
        input: hsl(H, 0.35, 0.3),
        gradientFrom: primary,
        gradientVia: secondary,
        gradientTo: accent,
        glow: primary,
        overlay: withAlpha(background, 0.55),
        destructive: "#ff4d4f",
        destructiveForeground: ink,
      };
    }

    case "ink-and-paper": {
      const paperHue = typeof p.paperHue === "number" ? p.paperHue : 40;
      // Deep cream newsprint + warm-black ink + one saturated editorial accent (oxblood for reds).
      const background = hsl(paperHue, 0.48, 0.925);
      const foreground = ensureContrast(hsl(H, 0.3, 0.075), background, 13);
      const accent = ensureContrast(hsl(H, clamp(S, 0.68, 0.88), 0.37), background, 6);
      return {
        background,
        foreground,
        surface: hsl(paperHue, 0.4, 0.895),
        surfaceForeground: foreground,
        muted: hsl(paperHue, 0.3, 0.86),
        mutedForeground: ensureContrast(hsl(paperHue, 0.12, 0.33), background, 6),
        primary: foreground,
        primaryForeground: background,
        secondary: hsl(H, 0.35, 0.84),
        secondaryForeground: foreground,
        accent,
        accentForeground: readableOn(accent, background, foreground),
        border: mix(foreground, background, 0.78),
        ring: accent,
        input: mix(foreground, background, 0.7),
        gradientFrom: background,
        gradientVia: hsl(paperHue, 0.4, 0.895),
        gradientTo: hsl(paperHue, 0.32, 0.85),
        glow: withAlpha(accent, 0.12),
        overlay: withAlpha(foreground, 0.45),
        destructive: "#9f1239",
        destructiveForeground: "#ffffff",
      };
    }

    case "aurora-glass": {
      const spread = Array.isArray(p.hueSpread) ? (p.hueSpread as number[]) : [0, 55, 120];
      const H2 = normalizeHue(H + (spread[1] ?? 55));
      const H3 = base.secondaryHue !== null && hueDistance(base.secondaryHue, H) > 60 ? base.secondaryHue : normalizeHue(H + (spread[2] ?? 120));
      const background = hsl(H, 0.55, 0.09);
      const foreground = ensureContrast(hsl(H, 0.3, 0.97), background, 15);
      const primary = ensureContrast(hsl(H2, 0.9, 0.74), background, 8);
      const accent = ensureContrast(hsl(H3, 0.9, 0.72), background, 8);
      const deep = hsl(H, 0.6, 0.1);
      return {
        background,
        foreground,
        surface: withAlpha("#ffffff", 0.08),
        surfaceForeground: foreground,
        muted: withAlpha("#ffffff", 0.06),
        mutedForeground: ensureContrast(hsl(H, 0.25, 0.8), background, 8),
        primary,
        primaryForeground: readableOn(primary, foreground, deep),
        secondary: withAlpha("#ffffff", 0.14),
        secondaryForeground: foreground,
        accent,
        accentForeground: readableOn(accent, foreground, deep),
        border: withAlpha("#ffffff", 0.18),
        ring: primary,
        input: withAlpha("#ffffff", 0.22),
        gradientFrom: hsl(H, 0.75, 0.45),
        gradientVia: hsl(H2, 0.75, 0.5),
        gradientTo: hsl(H3, 0.7, 0.45),
        glow: primary,
        overlay: withAlpha(background, 0.5),
        destructive: "#ff8080",
        destructiveForeground: deep,
      };
    }

    case "high-contrast": {
      const fallback = typeof p.fallbackAccent === "string" && isHex(p.fallbackAccent) ? p.fallbackAccent : "#ff3b00";
      const raw = base.baseColor ? hsl(H, 1, 0.5) : fallback;
      // Accent blocks carry black text: keep black-on-accent ≥ 4.5.
      let accent = raw;
      if (contrastRatio("#000000", accent) < 4.5) accent = ensureContrast(accent, "#000000", 4.5);
      const secondary = hsl(normalizeHue(hexToHsl(accent).h + 180), 1, 0.5);
      return {
        background: "#ffffff",
        foreground: "#000000",
        surface: "#ffffff",
        surfaceForeground: "#000000",
        muted: "#efefef",
        mutedForeground: "#3a3a3a",
        primary: "#000000",
        primaryForeground: "#ffffff",
        secondary: contrastRatio("#000000", secondary) >= 4.5 ? secondary : ensureContrast(secondary, "#000000", 4.5),
        secondaryForeground: "#000000",
        accent,
        accentForeground: "#000000",
        border: "#000000",
        ring: accent,
        input: "#000000",
        gradientFrom: accent,
        gradientVia: accent,
        gradientTo: secondary,
        glow: accent,
        overlay: withAlpha("#000000", 0.6),
        destructive: "#ff0000",
        destructiveForeground: "#000000",
      };
    }

    case "warm-vintage": {
      const range = Array.isArray(p.warmRange) ? (p.warmRange as number[]) : [8, 30];
      const lo = range[0] ?? 8;
      const hi = range[1] ?? 30;
      // Keep warm source hues; project any other hue smoothly into brick → terracotta → burnt orange.
      const warm = H >= lo && H <= hi ? H : lo + ((normalizeHue(H + 30) / 360) * (hi - lo));
      // Manila / sun-faded record sleeve: warmer and more saturated than the editorial paper.
      const background = hsl(36, 0.7, 0.87);
      const foreground = ensureContrast(hsl(18, 0.5, 0.13), background, 11);
      const primary = ensureContrast(hsl(warm, 0.72, 0.42), background, 4.5);
      const secondary = hsl(42, 0.85, 0.5);
      const tealHue = base.secondaryHue !== null && hueDistance(base.secondaryHue, warm) > 90 ? base.secondaryHue : 176;
      const accent = ensureContrast(hsl(tealHue, 0.45, 0.3), background, 6);
      const cream = hsl(42, 0.75, 0.95);
      return {
        background,
        foreground,
        surface: hsl(38, 0.72, 0.92),
        surfaceForeground: foreground,
        muted: hsl(34, 0.5, 0.8),
        mutedForeground: ensureContrast(hsl(20, 0.25, 0.32), background, 6),
        primary,
        primaryForeground: readableOn(primary, cream, foreground),
        secondary,
        secondaryForeground: readableOn(secondary, cream, foreground),
        accent,
        accentForeground: readableOn(accent, cream, foreground),
        border: hsl(20, 0.35, 0.28),
        ring: accent,
        input: hsl(20, 0.3, 0.4),
        gradientFrom: primary,
        gradientVia: secondary,
        gradientTo: accent,
        glow: withAlpha(primary, 0.35),
        overlay: withAlpha(hsl(18, 0.45, 0.1), 0.45),
        destructive: "#b42318",
        destructiveForeground: cream,
      };
    }

    default:
      throw new Error(`Unknown palette strategy "${strategy}" in brief ${brief.id}`);
  }
}

function buildShadows(brief: DesignBrief, palette: ThemePalette): { sm: string; md: string; lg: string; color: string } {
  const solid = (c: string) => (isHex(c) ? c : "#000000");
  switch (brief.shadows) {
    case "none":
      return { sm: "none", md: "none", lg: "none", color: rgbChannels(solid(palette.foreground)) };
    case "glow": {
      const c = solid(palette.glow);
      return {
        sm: `0 0 18px -6px ${withAlpha(c, 0.55)}`,
        md: `0 12px 40px -12px ${withAlpha(c, 0.6)}`,
        lg: `0 24px 80px -20px ${withAlpha(c, 0.7)}`,
        color: rgbChannels(c),
      };
    }
    case "soft":
      return {
        sm: "0 2px 12px rgb(0 0 0 / 0.18)",
        md: "0 8px 32px rgb(0 0 0 / 0.32)",
        lg: "0 24px 64px rgb(0 0 0 / 0.42)",
        color: "0 0 0",
      };
    case "hard": {
      const c = solid(palette.foreground);
      return { sm: `3px 3px 0 0 ${c}`, md: `6px 6px 0 0 ${c}`, lg: `10px 10px 0 0 ${c}`, color: rgbChannels(c) };
    }
    case "offset": {
      const c = solid(palette.foreground);
      return { sm: `2px 2px 0 0 ${c}`, md: `4px 4px 0 0 ${c}`, lg: `8px 8px 0 0 ${c}`, color: rgbChannels(c) };
    }
    default:
      return { sm: "0 1px 2px rgb(0 0 0 / 0.08)", md: "0 4px 16px rgb(0 0 0 / 0.12)", lg: "0 16px 48px rgb(0 0 0 / 0.16)", color: "0 0 0" };
  }
}

function solidOr(c: string, fallback: string): string {
  return isHex(c) ? c : fallback;
}

/** Generate the complete theme for one brief from one inspiration token set. */
export function generateTheme(brief: DesignBrief, tokens: DesignTokens): Theme {
  const base = pickBaseColors(tokens, brief.palette.fallbackHue);
  const palette = buildPalette(brief, base);
  const shadows = buildShadows(brief, palette);
  const isGlass = brief.palette.strategy === "aurora-glass";
  const isRetro = brief.palette.strategy === "warm-vintage";

  const vars: Record<string, string> = {
    background: palette.background,
    foreground: palette.foreground,
    surface: palette.surface,
    "surface-foreground": palette.surfaceForeground,
    muted: palette.muted,
    "muted-foreground": palette.mutedForeground,
    primary: palette.primary,
    "primary-foreground": palette.primaryForeground,
    secondary: palette.secondary,
    "secondary-foreground": palette.secondaryForeground,
    accent: palette.accent,
    "accent-foreground": palette.accentForeground,
    border: palette.border,
    ring: palette.ring,
    input: palette.input,
    card: palette.surface,
    "card-foreground": palette.surfaceForeground,
    popover: isGlass ? solidOr(palette.background, "#111111") : palette.surface,
    "popover-foreground": palette.foreground,
    destructive: palette.destructive,
    "destructive-foreground": palette.destructiveForeground,
    "gradient-from": palette.gradientFrom,
    "gradient-via": palette.gradientVia,
    "gradient-to": palette.gradientTo,
    glow: palette.glow,
    overlay: palette.overlay,
    radius: `${brief.radius.base}px`,
    "radius-sm": `${brief.radius.sm}px`,
    "radius-lg": brief.radius.lg >= 999 ? "9999px" : `${brief.radius.lg}px`,
    "shadow-sm": shadows.sm,
    "shadow-md": shadows.md,
    "shadow-lg": shadows.lg,
    "shadow-color": shadows.color,
    "container-max": `${brief.containerWidth}px`,
    "section-space": "clamp(4rem, 9vw, 9rem)",
    "grain-opacity": isRetro ? "0.16" : "0",
    "glass-bg": isGlass ? withAlpha("#ffffff", 0.08) : palette.surface,
    "glass-border": isGlass ? withAlpha("#ffffff", 0.18) : palette.border,
    "glass-blur": isGlass ? "18px" : "0px",
  };

  const bgSolid = solidOr(palette.background, "#000000");
  const fgSolid = solidOr(palette.foreground, "#ffffff");
  return {
    briefId: brief.id,
    briefName: brief.name,
    mode: brief.mode,
    strategy: brief.palette.strategy,
    source: { slug: tokens.slug, url: tokens.sourceUrl, extractor: tokens.extractor },
    baseHue: Math.round(base.hue),
    baseColor: base.baseColor,
    secondaryHue: base.secondaryHue === null ? null : Math.round(base.secondaryHue),
    palette,
    vars,
    fonts: brief.fonts,
    radius: brief.radius,
    shadows: { sm: shadows.sm, md: shadows.md, lg: shadows.lg },
    containerMax: brief.containerWidth,
    motion: brief.motion,
    contrast: {
      foregroundOnBackground: round2(contrastRatio(fgSolid, bgSolid)),
      mutedOnBackground: round2(contrastRatio(solidOr(palette.mutedForeground, fgSolid), bgSolid)),
      primaryOnBackground: round2(contrastRatio(solidOr(palette.primary, fgSolid), bgSolid)),
      accentOnBackground: round2(contrastRatio(solidOr(palette.accent, fgSolid), bgSolid)),
      primaryForegroundOnPrimary: round2(
        contrastRatio(solidOr(palette.primaryForeground, bgSolid), solidOr(palette.primary, fgSolid)),
      ),
    },
    inspirationFonts: tokens.typography.families,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Visual distance between two themes (mean ΔE over key roles). Used for uniqueness checks. */
export function paletteDistance(a: Theme, b: Theme): number {
  const roles: Array<keyof ThemePalette> = ["background", "foreground", "primary", "accent", "secondary"];
  let total = 0;
  let n = 0;
  for (const role of roles) {
    const x = toHex(a.palette[role]);
    const y = toHex(b.palette[role]);
    if (!x || !y) continue;
    total += deltaE(x, y);
    n++;
  }
  return n ? Math.round((total / n) * 10) / 10 : 0;
}

function fontStack(spec: FontSpec | null, cssVar: string, generic: string): string {
  if (!spec) return generic;
  return [`var(${cssVar})`, ...spec.fallback.map((f) => (/\s/.test(f) && !/^["']/.test(f) ? `"${f}"` : f))].join(", ");
}

/** `:root { … }` block with every theme variable. */
export function renderThemeVariables(theme: Theme): string {
  const lines = Object.entries(theme.vars).map(([k, v]) => `  --${k}: ${v};`);
  if (!theme.fonts.mono) lines.push(`  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;`);
  return `:root {\n${lines.join("\n")}\n}`;
}

/**
 * Full app/globals.css: Tailwind v4 import + legacy JS config (tailwind.config.ts) + theme
 * variables + base layer + the brief's own stylesheet (templates/briefs/<id>/styles.css).
 */
export function renderGlobalsCss(theme: Theme, briefCss: string, note?: string): string {
  const display = fontStack(theme.fonts.display, "--font-display", "serif");
  const body = fontStack(theme.fonts.body, "--font-body", "sans-serif");
  return `@import "tailwindcss";
@config "../tailwind.config.ts";

/*
 * Theme for brief "${theme.briefName}" (${theme.strategy}).
 * Derived from design tokens extracted by chhapify from ${theme.source.url ?? "the default token set"}
 * (base hue ${theme.baseHue}°${theme.baseColor ? `, base color ${theme.baseColor}` : ""}).${note ? `\n * ${note}` : ""}
 * Variable names follow shadcn/ui conventions, so components/ui/* work unchanged.
 */
${renderThemeVariables(theme)}

@layer base {
  html {
    color-scheme: ${theme.mode};
    scroll-behavior: smooth;
    -webkit-text-size-adjust: 100%;
  }
  body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: ${body};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  h1, h2, h3, h4 {
    font-family: ${display};
  }
  ::selection {
    background-color: var(--accent);
    color: var(--accent-foreground);
  }
  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }
  img, video, iframe {
    max-width: 100%;
  }
  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}

/* ---------------------------------------------------------------------------
 * Brief styles: templates/briefs/${theme.briefId}/styles.css
 * ------------------------------------------------------------------------- */
${briefCss.trim()}
`;
}

/** tailwind.config.ts mapping Tailwind utilities onto the theme variables (loaded via @config). */
export function renderTailwindConfig(theme: Theme): string {
  const q = (arr: string[]) => arr.map((f) => JSON.stringify(f)).join(", ");
  const mono = theme.fonts.mono ? `"var(--font-mono)", ${q(theme.fonts.mono.fallback)}` : `"var(--font-mono)", "ui-monospace", "monospace"`;
  return `import type { Config } from "tailwindcss";

/**
 * Tailwind theme for brief "${theme.briefName}".
 * Colors resolve to CSS variables defined in app/globals.css (generated from extracted design tokens).
 * Loaded by Tailwind v4 through \`@config "../tailwind.config.ts";\` in globals.css.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: { DEFAULT: "var(--surface)", foreground: "var(--surface-foreground)" },
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
        accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },
        destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        glow: "var(--glow)",
        overlay: "var(--overlay)",
        "gradient-from": "var(--gradient-from)",
        "gradient-via": "var(--gradient-via)",
        "gradient-to": "var(--gradient-to)",
      },
      fontFamily: {
        display: ["var(--font-display)", ${q(theme.fonts.display.fallback)}],
        body: ["var(--font-body)", ${q(theme.fonts.body.fallback)}],
        sans: ["var(--font-body)", ${q(theme.fonts.body.fallback)}],
        mono: [${mono}],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
        md: "var(--radius)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      maxWidth: {
        container: "var(--container-max)",
      },
      spacing: {
        section: "var(--section-space)",
      },
    },
  },
};

export default config;
`;
}

/** lib/theme.ts — the theme as data, for components that need raw values (motion, canvas, inline styles). */
export function renderThemeModule(theme: Theme): string {
  const data = {
    briefId: theme.briefId,
    briefName: theme.briefName,
    mode: theme.mode,
    palette: theme.palette,
    radius: theme.radius,
    motion: theme.motion,
    containerMax: theme.containerMax,
    source: theme.source,
  };
  return `/**
 * Theme values for this site (generated by artist-site-factory's theme generator).
 * Prefer Tailwind classes (bg-primary, text-muted-foreground…) or CSS variables; use this module only
 * when a raw value is needed in JavaScript (e.g. Framer Motion color animations).
 */
export interface SiteTheme {
  briefId: string;
  briefName: string;
  mode: "light" | "dark";
  palette: Record<string, string>;
  radius: { base: number; sm: number; lg: number };
  motion: { preset: string; duration: number; ease: number[] | string; distance: number };
  containerMax: number;
  source: { slug: string; url: string | null; extractor: string };
}

export const theme: SiteTheme = ${JSON.stringify(data, null, 2)};
`;
}
