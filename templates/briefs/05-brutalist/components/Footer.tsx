import type { FooterProps } from "@/lib/types";
import { platformLabel } from "@/components/BrandIcons";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function Footer({ brand, tagline, links, socials, copyright, credits, sources }: FooterProps) {
  return (
    <footer className="mt-10 border-t-[3px] border-foreground bg-foreground text-background">
      <div className="skin-container grid gap-8 py-10 md:grid-cols-3">
        <div>
          <p className="font-display text-4xl font-bold uppercase">[{brand}]</p>
          {tagline ? <p className="mt-2 text-sm text-background/70">{tagline}</p> : null}
        </div>
        <ul className="text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <a {...linkAttrs(l.href)} className="inline-flex min-h-9 items-center uppercase hover:bg-accent hover:text-accent-foreground">
                /{l.label}
              </a>
            </li>
          ))}
        </ul>
        <ul className="text-sm">
          {socials.map((s) => (
            <li key={s.href}>
              <a {...linkAttrs(s.href)} className="inline-flex min-h-9 items-center uppercase hover:bg-accent hover:text-accent-foreground">
                → {platformLabel(s.platform)}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="overflow-hidden whitespace-nowrap border-y border-background/40 py-1 text-xs text-background/50" aria-hidden>
        {"/".repeat(400)}
      </div>
      <div className="skin-container py-6 text-xs leading-6 text-background/80">
        <p className="font-bold text-background">
          {copyright}. {t("allRightsReserved")}
        </p>
        {credits.map((c) => (
          <p key={c}>// {c}</p>
        ))}
        {sources?.length ? (
          <p>
            // {t("sources")}:{" "}
            {sources.map((s, i) => (
              <span key={s.href}>
                {i > 0 ? " | " : ""}
                <a {...linkAttrs(s.href)} className="underline hover:bg-accent hover:text-accent-foreground">
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
