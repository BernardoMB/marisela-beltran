"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { NavBarProps } from "@/lib/types";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function NavBar({ brand, links, cta }: NavBarProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);
  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 rounded-full border border-white/10 bg-background/70 pl-6 pr-2 shadow-md backdrop-blur-xl" aria-label={brand}>
        <a href="#inicio" className="font-display text-2xl uppercase tracking-wide">
          <span className="bold-gradient-text">{brand}</span>
        </a>
        <ul className="hidden items-center gap-6 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a {...linkAttrs(l.href)} className="text-xs font-extrabold uppercase tracking-[0.18em] text-foreground/80 transition hover:text-accent">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          {cta ? (
            <a {...linkAttrs(cta.href)} className="skin-btn hidden h-10 items-center px-5 text-xs sm:inline-flex">
              {cta.label}
            </a>
          ) : null}
          <button type="button" onClick={() => setOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground lg:hidden" aria-label={t("openMenu")} aria-expanded={open}>
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-linear-to-br from-gradient-from via-gradient-via to-gradient-to p-6 text-primary-foreground"
            initial={{ clipPath: "circle(0% at 90% 5%)" }}
            animate={{ clipPath: "circle(150% at 90% 5%)" }}
            exit={{ clipPath: "circle(0% at 90% 5%)" }}
            transition={{ duration: 0.55, ease: [0.34, 1.2, 0.64, 1] }}
          >
            <button type="button" onClick={() => setOpen(false)} className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-background text-foreground" aria-label={t("closeMenu")}>
              <X className="h-5 w-5" aria-hidden />
            </button>
            <ul className="mt-8 flex flex-col gap-1">
              {[...links, ...(cta ? [cta] : [])].map((l, i) => (
                <motion.li key={l.href} initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.15 + i * 0.05, type: "spring", stiffness: 260, damping: 18 }}>
                  <a {...linkAttrs(l.href)} onClick={() => setOpen(false)} className="font-display text-[clamp(3rem,14vw,6rem)] uppercase leading-[0.95] text-background">
                    {l.label}
                  </a>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
