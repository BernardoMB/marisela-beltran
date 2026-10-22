import type { SectionDividerProps } from "@/lib/types";

/**
 * Decorative break between sections. Variants map to the six briefs: hairline (minimalist),
 * marquee (bold), chapter-rule (editorial), glow (glassmorphism), ascii (brutalist), ornament (retro).
 * Styles live in each brief's styles.css (.divider-*).
 */
export default function SectionDivider({ label, variant = "hairline" }: SectionDividerProps) {
  const text = (label ?? "").trim();
  switch (variant) {
    case "marquee": {
      const run = Array.from({ length: 8 }, () => text || "★").join("  ✦  ");
      return (
        <div className="divider-marquee overflow-hidden" aria-hidden="true">
          <div className="divider-marquee-track flex w-max whitespace-nowrap">
            <span className="px-4">{run}</span>
            <span className="px-4">{run}</span>
          </div>
        </div>
      );
    }
    case "chapter-rule":
      return (
        <div className="divider-chapter skin-container flex items-center gap-6" role="separator">
          <span className="h-px flex-1 bg-current opacity-30" />
          {text ? <span className="text-xs uppercase tracking-[0.35em]">{text}</span> : null}
          <span className="h-px flex-1 bg-current opacity-30" />
        </div>
      );
    case "glow":
      return <div className="divider-glow skin-container" role="separator" />;
    case "ascii": {
      const inner = text ? `[ ${text.toUpperCase()} ]` : "";
      return (
        <div className="divider-ascii overflow-hidden whitespace-nowrap" role="separator" aria-label={text || undefined}>
          <span aria-hidden="true">{`${"=".repeat(40)}${inner}${"=".repeat(200)}`}</span>
        </div>
      );
    }
    case "ornament":
      return (
        <div className="divider-ornament skin-container flex items-center justify-center gap-4" role="separator">
          <span aria-hidden="true">✦ ✦ ✦</span>
          {text ? <span className="text-sm">{text}</span> : null}
          <span aria-hidden="true">✦ ✦ ✦</span>
        </div>
      );
    default:
      return <hr className="divider-hairline skin-container" />;
  }
}
