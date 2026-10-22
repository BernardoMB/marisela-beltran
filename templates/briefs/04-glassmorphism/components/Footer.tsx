import type { FooterProps } from "@/lib/types";
import { BrandIcon, platformLabel } from "@/components/BrandIcons";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function Footer({ brand, tagline, links, socials, copyright, credits, sources }: FooterProps) {
  return (
    <footer className="px-4 pb-6 pt-10 md:px-8">
      <div className="glass mx-auto max-w-[1280px] p-8 md:p-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-display text-3xl font-light">{brand}</p>
            {tagline ? <p className="mt-1 text-sm text-muted-foreground">{tagline}</p> : null}
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {links.map((l) => (
              <li key={l.href}>
                <a {...linkAttrs(l.href)} className="text-foreground/80 hover:text-primary">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap gap-2">
            {socials.map((s) => (
              <li key={s.href}>
                <a {...linkAttrs(s.href)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 hover:text-primary" aria-label={platformLabel(s.platform)}>
                  <BrandIcon platform={s.platform} className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-8 border-t border-white/10 pt-6 text-xs leading-relaxed text-muted-foreground">
          <p className="text-foreground/80">
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
                  <a {...linkAttrs(s.href)} className="hover:text-primary">
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
