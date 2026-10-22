import type { FooterProps } from "@/lib/types";
import { platformLabel } from "@/components/BrandIcons";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function Footer({ brand, tagline, links, socials, copyright, credits, sources }: FooterProps) {
  return (
    <footer className="mt-16 border-t-[3px] border-double border-foreground">
      <div className="skin-container py-14">
        <p className="text-center font-display text-6xl font-black italic md:text-8xl">{brand}</p>
        {tagline ? <p className="ed-smallcaps mt-2 text-center text-lg text-accent">{tagline}</p> : null}
        <div className="mt-12 grid gap-10 border-t border-foreground pt-8 text-sm md:grid-cols-3">
          <div>
            <p className="ed-smallcaps mb-3 text-base text-accent">{t("viewAll")}</p>
            <ul className="space-y-2">
              {links.map((l) => (
                <li key={l.href}>
                  <a {...linkAttrs(l.href)} className="font-display text-lg italic hover:text-accent">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="ed-smallcaps mb-3 text-base text-accent">{t("followOn")}</p>
            <ul className="space-y-2">
              {socials.map((s) => (
                <li key={s.href}>
                  <a {...linkAttrs(s.href)} className="font-display text-lg italic hover:text-accent">
                    {platformLabel(s.platform)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="ed-caption space-y-2 not-italic">
            <p className="ed-smallcaps text-base not-italic text-accent">{t("sources")}</p>
            {credits.map((c) => (
              <p key={c}>{c}</p>
            ))}
            {sources?.length ? (
              <p>
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
        </div>
        <p className="ed-caption mt-10 border-t border-border pt-4 text-center">
          {copyright}. {t("allRightsReserved")}
        </p>
      </div>
    </footer>
  );
}
