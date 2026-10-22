import type { FooterProps } from "@/lib/types";
import { BrandIcon, platformLabel } from "@/components/BrandIcons";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function Footer({ brand, tagline, links, socials, copyright, credits, sources }: FooterProps) {
  return (
    <footer className="mt-12 border-t border-border">
      <div className="skin-container grid gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="font-display text-5xl font-extralight tracking-tight">{brand}</p>
          {tagline ? <p className="mt-3 text-sm text-muted-foreground">{tagline}</p> : null}
        </div>
        <nav className="md:col-span-3" aria-label={brand}>
          <ul className="space-y-3">
            {links.map((l) => (
              <li key={l.href}>
                <a {...linkAttrs(l.href)} className="min-label text-muted-foreground hover:text-foreground">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <ul className="flex flex-wrap content-start gap-4 md:col-span-4 md:justify-end">
          {socials.map((s) => (
            <li key={s.href}>
              <a {...linkAttrs(s.href)} className="flex h-11 w-11 items-center justify-center border border-border text-muted-foreground transition hover:border-foreground hover:text-foreground" aria-label={platformLabel(s.platform)}>
                <BrandIcon platform={s.platform} className="h-4 w-4" />
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="skin-container border-t border-border py-8 text-xs leading-relaxed text-muted-foreground">
        <p>
          {copyright}. {t("allRightsReserved")}
        </p>
        {credits.map((c) => (
          <p key={c} className="mt-1">
            {c}
          </p>
        ))}
        {sources?.length ? (
          <p className="mt-3">
            {t("sources")}:{" "}
            {sources.map((s, i) => (
              <span key={s.href}>
                {i > 0 ? " · " : ""}
                <a {...linkAttrs(s.href)} className="underline-offset-2 hover:underline">
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
