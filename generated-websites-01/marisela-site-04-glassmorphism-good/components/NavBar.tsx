"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import type { NavBarProps } from "@/lib/types";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function NavBar({ brand, links, cta }: NavBarProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3 md:top-5 md:px-6">
      <nav className="glass mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-5 md:px-7" aria-label={brand}>
        <a href="#inicio" className="font-display text-xl font-semibold tracking-tight">
          {brand}
        </a>
        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a {...linkAttrs(l.href)} className="rounded-full px-4 py-2 text-sm text-foreground/80 transition hover:bg-foreground/10 hover:text-foreground">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          {cta ? (
            <a {...linkAttrs(cta.href)} className="skin-btn hidden h-10 items-center px-5 text-sm font-semibold sm:inline-flex">
              {cta.label}
            </a>
          ) : null}
          <button type="button" onClick={() => setOpen((o) => !o)} className="skin-btn-ghost flex h-11 w-11 items-center justify-center lg:hidden" aria-label={open ? t("closeMenu") : t("openMenu")} aria-expanded={open}>
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open ? (
          <motion.ul
            initial={{ opacity: 0, y: -10, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
            className="glass-strong mx-auto mt-2 flex max-w-[1280px] flex-col gap-1 p-3 lg:hidden"
          >
            {[...links, ...(cta ? [cta] : [])].map((l) => (
              <li key={l.href}>
                <a {...linkAttrs(l.href)} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-lg hover:bg-foreground/10">
                  {l.label}
                </a>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
