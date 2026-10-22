"use client";

import { useState } from "react";
import type { NavBarProps } from "@/lib/types";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function NavBar({ brand, links, cta }: NavBarProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-foreground bg-background">
      <nav className="skin-container flex items-stretch justify-between" aria-label={brand}>
        <a href="#inicio" className="brut-invert flex items-center border-r-[3px] border-foreground py-3 pr-4 font-display text-lg font-bold uppercase">
          [{brand}]
        </a>
        <ul className="hidden flex-1 items-stretch lg:flex">
          {links.map((l) => (
            <li key={l.href} className="flex border-r border-foreground">
              <a {...linkAttrs(l.href)} className="brut-invert flex items-center px-4 text-xs font-semibold uppercase">
                /{l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-stretch">
          {cta ? (
            <a {...linkAttrs(cta.href)} className="hidden items-center border-l-[3px] border-foreground bg-accent px-5 text-sm font-bold uppercase text-accent-foreground hover:bg-foreground hover:text-background sm:flex">
              {cta.label}
            </a>
          ) : null}
          <button type="button" onClick={() => setOpen((o) => !o)} className="brut-invert min-h-11 border-l-[3px] border-foreground px-4 text-sm font-bold uppercase lg:hidden" aria-expanded={open}>
            [{open ? t("close") : t("openMenu")}]
          </button>
        </div>
      </nav>
      {open ? (
        <ul className="border-t-[3px] border-foreground lg:hidden">
          {[...links, ...(cta ? [cta] : [])].map((l, i) => (
            <li key={l.href} className="border-b border-foreground">
              <a {...linkAttrs(l.href)} onClick={() => setOpen(false)} className="brut-invert flex min-h-12 items-center gap-4 px-5 font-bold uppercase">
                <span className="text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
