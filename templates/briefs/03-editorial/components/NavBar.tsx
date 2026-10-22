"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { NavBarProps } from "@/lib/types";
import { t } from "@/lib/i18n";
import { cn, linkAttrs } from "@/lib/utils";

export default function NavBar({ brand, links, cta }: NavBarProps) {
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 160);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={cn("sticky top-0 z-50 border-b border-foreground bg-background/95 backdrop-blur transition-all", compact ? "shadow-none" : "")}>
      <div className="skin-container flex items-center justify-between gap-6 py-3">
        <a href="#inicio" className={cn("font-display italic leading-none transition-all duration-500", compact ? "text-2xl" : "text-3xl md:text-4xl")}>
          {brand}
        </a>
        <nav aria-label={brand} className="hidden md:block">
          <ul className="flex items-center divide-x divide-border">
            {links.map((l) => (
              <li key={l.href} className="px-4">
                <a {...linkAttrs(l.href)} className="ed-smallcaps text-[1.05rem] hover:text-accent">
                  {l.label}
                </a>
              </li>
            ))}
            {cta ? (
              <li className="pl-4">
                <a {...linkAttrs(cta.href)} className="ed-smallcaps border border-foreground px-3 py-1 text-[1.05rem] transition hover:bg-foreground hover:text-background">
                  {cta.label}
                </a>
              </li>
            ) : null}
          </ul>
        </nav>
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-11 w-11 items-center justify-center md:hidden" aria-label={open ? t("closeMenu") : t("openMenu")} aria-expanded={open}>
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>
      {open ? (
        <ul className="skin-container border-t border-border pb-6 md:hidden">
          {[...links, ...(cta ? [cta] : [])].map((l) => (
            <li key={l.href} className="border-b border-border">
              <a {...linkAttrs(l.href)} onClick={() => setOpen(false)} className="block py-4 font-display text-2xl italic">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
