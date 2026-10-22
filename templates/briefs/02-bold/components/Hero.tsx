"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import type { HeroProps } from "@/lib/types";
import { SmartImage } from "@/components/SmartImage";
import { cn, linkAttrs } from "@/lib/utils";

export default function Hero({ anchorId, variant, title, eyebrow, subtitle, tagline, primaryCta, secondaryCta, image, stats, showScrollIndicator }: HeroProps) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120]);
  const rotate = useTransform(scrollYProgress, [0, 1], [-6, reduce ? -6 : 4]);
  const words = title.toUpperCase().split(/\s+/);
  const pop = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 60, scale: 0.9 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { type: "spring" as const, stiffness: 140, damping: 14, delay } });
  const poster = variant === "poster";

  return (
    <section ref={ref} id={anchorId} className="relative isolate min-h-[100svh] overflow-hidden pb-16 pt-28 md:pt-32">
      <span className="bold-blob bold-drift -left-24 top-10 h-[28rem] w-[28rem] bg-gradient-from" aria-hidden />
      <span className="bold-blob bold-drift right-0 top-1/3 h-[24rem] w-[24rem] bg-gradient-via [animation-delay:-5s]" aria-hidden />
      <span className="bold-blob bold-drift bottom-0 left-1/3 h-[22rem] w-[22rem] bg-gradient-to [animation-delay:-9s]" aria-hidden />

      <div className={cn("relative mx-auto grid max-w-[1440px] gap-10 px-5 md:px-10", poster ? "lg:grid-cols-2 lg:items-center" : "")}>
        <div className={cn("relative z-10", poster && "rounded-[var(--radius-lg)] bg-linear-to-br from-gradient-from via-gradient-via to-gradient-to p-8 text-primary-foreground shadow-lg md:p-12")}>
          {eyebrow ? (
            <motion.p {...pop(0)} className={cn("mb-4 inline-block rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-[0.25em]", poster ? "bg-background text-foreground" : "bg-accent text-accent-foreground")}>
              {eyebrow}
            </motion.p>
          ) : null}
          <h1 className="font-display uppercase leading-[0.82]">
            {words.map((w, i) => (
              <motion.span key={`${w}-${i}`} {...pop(0.08 + i * 0.08)} className={cn("block text-[clamp(4.5rem,19vw,15rem)]", poster ? "text-background" : "bold-gradient-text", i % 2 === 1 && !poster && "md:pl-[12vw]")}>
                {w}
              </motion.span>
            ))}
          </h1>
          {tagline ? (
            <motion.p {...pop(0.3)} className={cn("mt-6 max-w-xl text-xl font-extrabold uppercase tracking-wide md:text-2xl", poster ? "text-background" : "text-foreground")}>
              {tagline}
            </motion.p>
          ) : null}
          {subtitle ? (
            <motion.p {...pop(0.36)} className={cn("mt-4 max-w-lg text-base", poster ? "text-background/85" : "text-muted-foreground")}>
              {subtitle}
            </motion.p>
          ) : null}
          <motion.div {...pop(0.42)} className="mt-8 flex flex-wrap gap-3">
            {primaryCta ? (
              <a {...linkAttrs(primaryCta.href)} className={cn("inline-flex h-14 items-center px-8 text-sm", poster ? "rounded-full bg-background font-extrabold uppercase tracking-wider text-foreground" : "skin-btn")}>
                {primaryCta.label}
              </a>
            ) : null}
            {secondaryCta ? (
              <a {...linkAttrs(secondaryCta.href)} className={cn("skin-btn-ghost inline-flex h-14 items-center px-8 text-sm", poster && "border-background text-background")}>
                {secondaryCta.label}
              </a>
            ) : null}
          </motion.div>
        </div>

        {image ? (
          <motion.div
            style={{ y, rotate }}
            className={cn(
              "relative z-0 mx-auto w-[min(78vw,30rem)]",
              poster ? "lg:mx-0" : "md:absolute md:right-[6vw] md:top-[18vh] md:w-[min(34vw,30rem)]",
            )}
          >
            <div className="skin-media relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-lg)] ring-4 ring-accent">
              <SmartImage image={image} fill priority sizes="(min-width: 768px) 34vw, 78vw" />
            </div>
            {stats?.slice(0, 2).map((s, i) => (
              <span key={s.id} className={cn("bold-sticker absolute h-28 w-28 p-3 text-[10px] leading-tight", i === 0 ? "-left-8 bottom-10 rotate-[-12deg]" : "-right-6 top-8 rotate-[10deg] bg-secondary text-secondary-foreground")}>
                <span className="font-display text-3xl leading-none">{s.value}</span>
                {s.label}
              </span>
            ))}
          </motion.div>
        ) : null}
      </div>
      {showScrollIndicator ? (
        <span className="absolute bottom-6 left-1/2 h-12 w-7 -translate-x-1/2 rounded-full border-2 border-foreground/50" aria-hidden>
          <span className="mx-auto mt-2 block h-2 w-1 animate-bounce rounded-full bg-accent" />
        </span>
      ) : null}
    </section>
  );
}
