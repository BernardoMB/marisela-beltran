"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HeroProps } from "@/lib/types";
import { SmartImage } from "@/components/SmartImage";
import { briefTransition } from "@/components/Reveal";
import { cn, linkAttrs } from "@/lib/utils";

export default function Hero({ anchorId, variant, title, eyebrow, subtitle, tagline, primaryCta, secondaryCta, image, stats }: HeroProps) {
  const reduce = useReducedMotion();
  const slide = (d: number, x = -40) => (reduce ? {} : { initial: { opacity: 0, x }, animate: { opacity: 1, x: 0 }, transition: briefTransition(d) });
  const sleeve = variant !== "sunburst" && Boolean(image);

  return (
    <section id={anchorId} className="retro-sunburst relative overflow-hidden border-b-2 border-border">
      <div className={cn("skin-container grid min-h-[88svh] items-center gap-12 py-16", sleeve ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" : "text-center")}>
        <div className={cn("relative z-10 min-w-0", !sleeve && "mx-auto max-w-4xl")}>
          {eyebrow ? (
            <motion.p {...slide(0)} className={cn("retro-mono mb-6 inline-block rotate-[-3deg] rounded-full border-2 border-border bg-secondary px-5 py-2 text-xs text-secondary-foreground shadow-md")}>
              ★ {eyebrow} ★
            </motion.p>
          ) : null}
          <motion.h1 {...slide(0.1)} className={cn("retro-display leading-[0.95] text-foreground [overflow-wrap:anywhere]", sleeve ? "text-[clamp(3.5rem,8vw,7.5rem)]" : "text-[clamp(4rem,12vw,10rem)]")}>
            {title}
          </motion.h1>
          {tagline ? (
            <motion.p {...slide(0.2)} className="mt-6 text-2xl font-bold italic text-foreground">
              {tagline}
            </motion.p>
          ) : null}
          {subtitle ? (
            <motion.p {...slide(0.3)} className={cn("mt-4 max-w-xl rounded-[var(--radius)] border-2 border-border bg-surface p-4 text-base leading-relaxed shadow-md", !sleeve && "mx-auto")}>
              {subtitle}
            </motion.p>
          ) : null}
          <motion.div {...slide(0.4)} className={cn("mt-8 flex flex-wrap gap-4", !sleeve && "justify-center")}>
            {primaryCta ? (
              <a {...linkAttrs(primaryCta.href)} className="skin-btn inline-flex h-14 items-center px-8 text-lg">
                {primaryCta.label}
              </a>
            ) : null}
            {secondaryCta ? (
              <a {...linkAttrs(secondaryCta.href)} className="skin-btn-ghost inline-flex h-14 items-center px-8 text-lg font-bold">
                {secondaryCta.label}
              </a>
            ) : null}
          </motion.div>
          {stats?.length ? (
            <ul className={cn("mt-10 flex flex-wrap gap-3", !sleeve && "justify-center")}>
              {stats.slice(0, 3).map((s, i) => (
                <li key={s.id} className={cn("rounded-[var(--radius)] border-2 border-border bg-surface px-4 py-2 shadow-sm", i % 2 ? "rotate-2" : "-rotate-2")}>
                  <span className="retro-display mr-2 text-2xl text-primary" style={{ textShadow: "none" }}>
                    {s.value}
                  </span>
                  <span className="retro-mono text-[11px]">{s.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {sleeve && image ? (
          <motion.div {...slide(0.2, 60)} className="relative mx-auto w-[min(72vw,24rem)] lg:ml-0">
            <div className="retro-vinyl retro-spin absolute right-[-24%] top-[5%] aspect-square w-[90%]" aria-hidden />
            <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius)] border-2 border-border shadow-lg">
              <SmartImage image={image} fill priority sizes="(min-width: 1024px) 24rem, 72vw" />
              <span className="retro-mono absolute left-3 top-3 rounded bg-background/90 px-2 py-1 text-[10px]">CAT. 001</span>
              <span className="retro-stripes absolute bottom-0 left-0 h-3 w-full" aria-hidden />
            </div>
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
