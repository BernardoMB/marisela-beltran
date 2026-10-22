import type { DesignBrief } from "../utils/config.js";
import { isHex, mix, toHex } from "./color.js";
import type { Theme } from "./theme-generator.js";

/**
 * Brief-aware SVG placeholder art (album covers without artwork, a hero when no free photo exists,
 * and the favicon). Pure SVG with generic font families so files render anywhere.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function solid(c: string, fallback: string): string {
  return isHex(c) ? c : (toHex(c) ?? fallback);
}

function wrap(text: string, max: number, maxLines = 4): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = `${cur} ${w}`.trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, max - 1)}…`;
    return kept;
  }
  return lines;
}

function palette(theme: Theme) {
  const p = theme.palette;
  const bg = solid(p.background, "#111111");
  const fg = solid(p.foreground, "#f5f5f5");
  return {
    bg,
    fg,
    surface: solid(p.surface, mix(bg, fg, 0.06)),
    primary: solid(p.primary, fg),
    secondary: solid(p.secondary, mix(bg, fg, 0.2)),
    accent: solid(p.accent, fg),
    from: solid(p.gradientFrom, solid(p.primary, fg)),
    via: solid(p.gradientVia, solid(p.secondary, fg)),
    to: solid(p.gradientTo, solid(p.accent, fg)),
    muted: solid(p.mutedForeground, mix(fg, bg, 0.4)),
  };
}

const FONTS = {
  sans: "Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
};

function textLines(lines: string[], x: number, y: number, size: number, opts: { family: string; fill: string; weight?: string | number; anchor?: string; style?: string; spacing?: number; transform?: (s: string) => string }): string {
  return lines
    .map(
      (l, i) =>
        `<text x="${x}" y="${y + i * size * 1.12}" font-family="${opts.family}" font-size="${size}" font-weight="${opts.weight ?? 400}"${opts.style ? ` font-style="${opts.style}"` : ""} fill="${opts.fill}" text-anchor="${opts.anchor ?? "start"}"${opts.spacing ? ` letter-spacing="${opts.spacing}"` : ""}>${esc(opts.transform ? opts.transform(l) : l)}</text>`,
    )
    .join("");
}

/** 1000×1000 album-cover placeholder in the brief's visual language. */
export function coverPlaceholderSvg(title: string, year: number | undefined, theme: Theme, brief: DesignBrief): string {
  const c = palette(theme);
  const y = year ? String(year) : "";
  let body: string;
  switch (brief.palette.strategy) {
    case "vibrant":
      body = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.from}"/><stop offset=".5" stop-color="${c.via}"/><stop offset="1" stop-color="${c.to}"/></linearGradient></defs>
<rect width="1000" height="1000" fill="url(#g)"/><text x="40" y="760" font-family="Impact, ${FONTS.sans}" font-size="720" fill="${c.bg}" opacity=".22">${esc(title.charAt(0).toUpperCase())}</text>
${textLines(wrap(title.toUpperCase(), 14), 60, 820, 76, { family: `Impact, ${FONTS.sans}`, fill: c.bg, weight: 700 })}${y ? textLines([y], 940, 110, 54, { family: FONTS.sans, fill: c.bg, anchor: "end", weight: 700 }) : ""}`;
      break;
    case "ink-and-paper":
      body = `<rect width="1000" height="1000" fill="${c.bg}"/><rect x="60" y="60" width="880" height="880" fill="none" stroke="${c.fg}" stroke-width="2"/>
<line x1="120" y1="640" x2="880" y2="640" stroke="${c.accent}" stroke-width="4"/>${textLines(wrap(title, 18), 120, 420, 72, { family: FONTS.serif, fill: c.fg, style: "italic" })}${y ? textLines([y], 120, 720, 40, { family: FONTS.serif, fill: c.muted, spacing: 6 }) : ""}`;
      break;
    case "aurora-glass":
      body = `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="90"/></filter></defs>
<rect width="1000" height="1000" fill="${c.bg}"/><g filter="url(#b)"><circle cx="300" cy="320" r="260" fill="${c.from}"/><circle cx="700" cy="420" r="240" fill="${c.via}"/><circle cx="480" cy="760" r="230" fill="${c.to}"/></g>
<rect x="110" y="560" width="780" height="320" rx="48" fill="#ffffff" fill-opacity=".1" stroke="#ffffff" stroke-opacity=".3"/>${textLines(wrap(title, 20, 2), 160, 680, 64, { family: FONTS.sans, fill: c.fg, weight: 600 })}${y ? textLines([y], 160, 840, 36, { family: FONTS.sans, fill: c.fg }) : ""}`;
      break;
    case "high-contrast":
      body = `<rect width="1000" height="1000" fill="#ffffff"/><rect x="24" y="24" width="952" height="952" fill="none" stroke="#000000" stroke-width="24"/>
<rect x="24" y="700" width="952" height="276" fill="${c.accent}"/>${textLines(wrap(title.toUpperCase(), 16), 80, 200, 70, { family: FONTS.mono, fill: "#000000", weight: 700 })}${textLines([`[${y || "----"}]`], 80, 880, 64, { family: FONTS.mono, fill: "#000000", weight: 700 })}`;
      break;
    case "warm-vintage": {
      const rays = Array.from({ length: 18 }, (_, i) => {
        const a1 = (i * 20 * Math.PI) / 180;
        const a2 = ((i * 20 + 10) * Math.PI) / 180;
        return `<polygon points="500,500 ${500 + 1000 * Math.cos(a1)},${500 + 1000 * Math.sin(a1)} ${500 + 1000 * Math.cos(a2)},${500 + 1000 * Math.sin(a2)}" fill="${i % 2 ? c.secondary : c.primary}"/>`;
      }).join("");
      body = `<rect width="1000" height="1000" fill="${c.bg}"/>${rays}<circle cx="500" cy="500" r="250" fill="#1a1a1a"/><circle cx="500" cy="500" r="80" fill="${c.bg}"/><circle cx="500" cy="500" r="10" fill="#1a1a1a"/>
<rect x="60" y="800" width="880" height="150" rx="20" fill="${c.bg}"/>${textLines(wrap(title, 26, 1), 500, 885, 58, { family: FONTS.serif, fill: c.fg, anchor: "middle", style: "italic", weight: 700 })}`;
      break;
    }
    default:
      body = `<rect width="1000" height="1000" fill="${c.surface}"/><line x1="100" y1="160" x2="900" y2="160" stroke="${c.fg}" stroke-width="1.5"/><circle cx="880" cy="160" r="8" fill="${c.accent}"/>
${textLines(wrap(title.toUpperCase(), 22), 100, 560, 46, { family: FONTS.sans, fill: c.fg, weight: 300, spacing: 8 })}${y ? textLines([y], 100, 860, 30, { family: FONTS.sans, fill: c.muted, spacing: 6 }) : ""}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" role="img" aria-label="${esc(title)}">${body}</svg>\n`;
}

/** 1600×1000 hero art used only when no freely licensed photo of the artist exists. */
export function heroPlaceholderSvg(name: string, theme: Theme, brief: DesignBrief): string {
  const c = palette(theme);
  const big = esc(name.toUpperCase());
  let body: string;
  switch (brief.palette.strategy) {
    case "vibrant":
    case "aurora-glass":
      body = `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="120"/></filter></defs><rect width="1600" height="1000" fill="${c.bg}"/>
<g filter="url(#b)" opacity=".9"><circle cx="420" cy="380" r="380" fill="${c.from}"/><circle cx="1150" cy="420" r="360" fill="${c.via}"/><circle cx="800" cy="860" r="340" fill="${c.to}"/></g>`;
      break;
    case "high-contrast":
      body = `<rect width="1600" height="1000" fill="#ffffff"/><rect x="0" y="0" width="1600" height="1000" fill="none" stroke="#000000" stroke-width="40"/><rect x="980" y="120" width="460" height="760" fill="${c.accent}"/><text x="120" y="560" font-family="${FONTS.mono}" font-size="150" font-weight="700" fill="#000000">${big}</text>`;
      break;
    case "warm-vintage": {
      const rays = Array.from({ length: 24 }, (_, i) => {
        const a1 = (i * 15 * Math.PI) / 180;
        const a2 = ((i * 15 + 7.5) * Math.PI) / 180;
        return `<polygon points="800,1000 ${800 + 2000 * Math.cos(a1 + Math.PI)},${1000 + 2000 * Math.sin(a1 + Math.PI)} ${800 + 2000 * Math.cos(a2 + Math.PI)},${1000 + 2000 * Math.sin(a2 + Math.PI)}" fill="${[c.primary, c.secondary, c.accent][i % 3]}"/>`;
      }).join("");
      body = `<rect width="1600" height="1000" fill="${c.bg}"/>${rays}`;
      break;
    }
    case "ink-and-paper":
      body = `<rect width="1600" height="1000" fill="${c.surface}"/><text x="800" y="620" font-family="${FONTS.serif}" font-size="260" font-style="italic" fill="${c.fg}" text-anchor="middle" opacity=".9">${esc(name)}</text><line x1="300" y1="700" x2="1300" y2="700" stroke="${c.accent}" stroke-width="6"/>`;
      break;
    default:
      body = `<rect width="1600" height="1000" fill="${c.surface}"/><text x="800" y="560" font-family="${FONTS.sans}" font-size="190" font-weight="200" letter-spacing="40" fill="${c.fg}" text-anchor="middle">${big}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="${esc(name)}">${body}</svg>\n`;
}

/** 64×64 monogram favicon in the theme's primary colors. */
export function faviconSvg(name: string, theme: Theme): string {
  const c = palette(theme);
  const fg = solid(theme.palette.primaryForeground, c.bg);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="${Math.min(theme.radius.base, 18)}" fill="${c.primary}"/><text x="32" y="45" font-family="Georgia, serif" font-size="38" font-weight="700" fill="${fg}" text-anchor="middle">${esc(name.charAt(0).toUpperCase())}</text></svg>\n`;
}
