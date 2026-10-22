import type { FooterProps } from "@/lib/types";
import { BrandIcon, platformLabel } from "@/components/BrandIcons";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function Footer({ brand, tagline, links, socials, copyright, credits, sources }: FooterProps) {
  return (
    <footer className="mt-12">
      <div className="retro-stripes h-8" aria-hidden />
      <div className="bg-foreground text-background">
        <div className="skin-container grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-display text-5xl" style={{ textShadow: "3px 3px 0 var(--primary)" }}>
              {brand}
            </p>
            {tagline ? <p className="mt-3 italic text-background/80">{tagline}</p> : null}
          </div>
          <ul className="retro-mono space-y-2 text-xs">
            {links.map((l) => (
              <li key={l.href}>
                <a {...linkAttrs(l.href)} className="hover:text-secondary">
                  ✦ {l.label}
                </a>
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap content-start gap-3">
            {socials.map((s) => (
              <li key={s.href}>
                <a {...linkAttrs(s.href)} className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-background/40 transition hover:bg-secondary hover:text-secondary-foreground" aria-label={platformLabel(s.platform)}>
                  <BrandIcon platform={s.platform} className="h-5 w-5" />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="skin-container border-t border-dashed border-background/30 py-6 text-xs leading-relaxed text-background/75">
          <p className="retro-mono text-background">
            {copyright}. {t("allRightsReserved")}
          </p>
          {credits.map((c) => (
            <p key={c}>{c}</p>
          ))}
          {sources?.length ? (
            <p className="mt-2">
              {t("sources")}:{" "}
              {sources.map((s, i) => (
                <span key={s.href}>
                  {i > 0 ? " · " : ""}
                  <a {...linkAttrs(s.href)} className="underline decoration-dashed underline-offset-2 hover:text-secondary">
                    {s.label}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
