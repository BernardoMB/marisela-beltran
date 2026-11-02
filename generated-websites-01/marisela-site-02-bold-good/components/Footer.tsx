import type { FooterProps } from "@/lib/types";
import { BrandIcon, platformLabel } from "@/components/BrandIcons";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function Footer({ brand, tagline, links, socials, copyright, credits, sources }: FooterProps) {
  return (
    <footer className="relative mt-10 overflow-hidden border-t border-white/10 pt-16">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            {links.map((l) => (
              <li key={l.href}>
                <a {...linkAttrs(l.href)} className="text-sm font-extrabold uppercase tracking-[0.18em] hover:text-accent">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <ul className="flex gap-2">
            {socials.map((s) => (
              <li key={s.href}>
                <a {...linkAttrs(s.href)} className="flex h-12 w-12 items-center justify-center rounded-full bg-surface transition hover:scale-110 hover:bg-primary hover:text-primary-foreground" aria-label={platformLabel(s.platform)}>
                  <BrandIcon platform={s.platform} className="h-5 w-5" />
                </a>
              </li>
            ))}
          </ul>
        </div>
        {tagline ? <p className="mt-10 text-sm font-bold uppercase tracking-[0.2em] text-accent">{tagline}</p> : null}
      </div>
      <p className="bold-gradient-text mt-4 whitespace-nowrap text-center font-display text-[clamp(5rem,24vw,22rem)] uppercase leading-[0.8]" aria-hidden>
        {brand}
      </p>
      <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-6 text-xs leading-relaxed text-muted-foreground md:px-10">
        <p className="font-bold text-foreground">
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
                <a {...linkAttrs(s.href)} className="hover:text-accent">
                  {s.label}
                </a>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
