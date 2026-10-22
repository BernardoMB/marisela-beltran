/**
 * Small, dependency-free color toolkit used by the theme generator:
 * hex ⇄ RGB ⇄ HSL, WCAG relative luminance / contrast, mixing, and contrast repair.
 * HSL here uses h ∈ [0, 360), s, l ∈ [0, 1].
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

export function isHex(value: string | null | undefined): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Parse #rgb, #rrggbb, #rrggbbaa, rgb()/rgba(), hsl()/hsla() into a 6-digit hex (alpha dropped). */
export function toHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) {
    const [r, g, b] = m[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) return `#${m[1]}`;
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (m) return rgbToHex({ r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) });
  m = v.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/);
  if (m) return hslToHex({ h: Number(m[1]), s: Number(m[2]) / 100, l: Number(m[3]) / 100 });
  // shadcn style "220 14% 96%" (space separated HSL without hsl())
  m = v.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (m) return hslToHex({ h: Number(m[1]), s: Number(m[2]) / 100, l: Number(m[3]) / 100 });
  return null;
}

export function hexToRgb(hex: string): RGB {
  const h = toHex(hex) ?? "#000000";
  return {
    r: Number.parseInt(h.slice(1, 3), 16),
    g: Number.parseInt(h.slice(3, 5), 16),
    b: Number.parseInt(h.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: normalizeHue(h * 60), s, l };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hh = normalizeHue(h) / 360;
  const ss = clamp01(s);
  const ll = clamp01(l);
  if (ss === 0) {
    const v = ll * 255;
    return { r: v, g: v, b: v };
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hue = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return { r: hue(hh + 1 / 3) * 255, g: hue(hh) * 255, b: hue(hh - 1 / 3) * 255 };
}

export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex));
}

export function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb(hsl));
}

/** Shorthand: hsl(h, s, l) with s/l in 0..1 → hex. */
export function hsl(h: number, s: number, l: number): string {
  return hslToHex({ h, s, l });
}

/** WCAG 2.x relative luminance. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Linear RGB mix: t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({ r: ca.r + (cb.r - ca.r) * t, g: ca.g + (cb.g - ca.g) * t, b: ca.b + (cb.b - ca.b) * t });
}

/** CSS color with alpha, e.g. "rgb(255 255 255 / 0.08)". */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${Number(alpha.toFixed(3))})`;
}

/** "r g b" channel triplet, handy for shadows built from a variable. */
export function rgbChannels(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

/** Of the candidates, the one with the highest contrast against `bg`. */
export function mostReadable(bg: string, candidates: string[] = ["#ffffff", "#0a0a0a"]): string {
  return [...candidates].sort((x, y) => contrastRatio(y, bg) - contrastRatio(x, bg))[0];
}

/**
 * Nudge `fg`'s lightness (keeping hue/saturation) until contrast with `bg` ≥ `min`.
 * Moves away from the background's lightness. Falls back to the most readable of black/white.
 */
export function ensureContrast(fg: string, bg: string, min = 4.5): string {
  if (contrastRatio(fg, bg) >= min) return fg;
  const f = hexToHsl(fg);
  const bgLight = luminance(bg) > 0.4;
  for (let i = 1; i <= 50; i++) {
    const l = bgLight ? f.l - i * 0.02 : f.l + i * 0.02;
    if (l < 0 || l > 1) break;
    const candidate = hslToHex({ h: f.h, s: f.s, l });
    if (contrastRatio(candidate, bg) >= min) return candidate;
  }
  return mostReadable(bg);
}

/** Perceptual-ish distance (CIE76 in Lab) between two colors. ~2.3 = just noticeable, >40 = very different. */
export function deltaE(a: string, b: string): number {
  const la = toLab(a);
  const lb = toLab(b);
  return Math.sqrt((la[0] - lb[0]) ** 2 + (la[1] - lb[1]) ** 2 + (la[2] - lb[2]) ** 2);
}

function toLab(hex: string): [number, number, number] {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

/** Smallest angular distance between two hues (0..180). */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(normalizeHue(a) - normalizeHue(b));
  return d > 180 ? 360 - d : d;
}

/** True if a color is chromatic enough to carry a brand hue. */
export function isChromatic(hex: string, minSaturation = 0.22): boolean {
  const { s, l } = hexToHsl(hex);
  return s >= minSaturation && l > 0.12 && l < 0.9;
}
