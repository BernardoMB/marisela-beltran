"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { NavBarProps } from "@/lib/types";
import { t } from "@/lib/i18n";
import { cn, linkAttrs } from "@/lib/utils";

export default function NavBar({ brand, links, cta }: NavBarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-colors duration-500", scrolled ? "border-b border-border bg-background/90 backdrop-blur" : "bg-transparent")}>
      <nav className="skin-container flex h-16 items-center justify-between" aria-label={brand}>
        <a href="#inicio" className="min-label text-foreground">
          {brand}
        </a>
        <ul className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a {...linkAttrs(l.href)} className="min-label text-muted-foreground transition hover:text-foreground">
                {l.label}
              </a>
            </li>
          ))}
          {cta ? (
            <li>
              <a {...linkAttrs(cta.href)} className="min-label inline-flex items-center gap-2 text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                {cta.label}
              </a>
            </li>
          ) : null}
        </ul>
        <button type="button" className="min-label flex h-11 items-center md:hidden" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="min-menu">
          {t("openMenu")}
        </button>
      </nav>
      <AnimatePresence>
        {open ? (
          <motion.div
            id="min-menu"
            className="fixed inset-0 z-50 flex flex-col bg-background px-6 pb-10 pt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex h-10 items-center justify-between">
              <span className="min-label">{brand}</span>
              <button type="button" className="min-label h-11" onClick={() => setOpen(false)}>
                {t("closeMenu")}
              </button>
            </div>
            <ul className="mt-16 flex flex-col gap-6">
              {[...links, ...(cta ? [cta] : [])].map((l, i) => (
                <motion.li key={l.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.5 }}>
                  <a {...linkAttrs(l.href)} onClick={() => setOpen(false)} className="font-display text-5xl font-extralight tracking-tight">
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
