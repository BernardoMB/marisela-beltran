"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import type { NavBarProps } from "@/lib/types";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function NavBar({ brand, links, cta }: NavBarProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50">
      <div className="retro-stripes h-2" aria-hidden />
      <nav className="border-b-2 border-border bg-background/95 backdrop-blur" aria-label={brand}>
        <div className="skin-container flex h-16 items-center justify-between gap-4">
          <a href="#inicio" className="retro-display text-2xl text-foreground" style={{ textShadow: "2px 2px 0 var(--secondary)" }}>
            {brand}
          </a>
          <ul className="hidden items-center gap-6 lg:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a {...linkAttrs(l.href)} className="retro-mono text-xs hover:text-primary">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            {cta ? (
              <a {...linkAttrs(cta.href)} className="skin-btn hidden h-10 items-center px-5 text-sm sm:inline-flex">
                {cta.label}
              </a>
            ) : null}
            <button type="button" onClick={() => setOpen((o) => !o)} className="skin-btn-ghost flex h-11 w-11 items-center justify-center lg:hidden" aria-label={open ? t("closeMenu") : t("openMenu")} aria-expanded={open}>
              {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>
        {open ? (
          <ul className="skin-container flex flex-col gap-1 pb-5 lg:hidden">
            {[...links, ...(cta ? [cta] : [])].map((l) => (
              <li key={l.href}>
                <a {...linkAttrs(l.href)} onClick={() => setOpen(false)} className="retro-display block py-2 text-3xl" style={{ textShadow: "2px 2px 0 var(--secondary)" }}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </nav>
    </header>
  );
}
