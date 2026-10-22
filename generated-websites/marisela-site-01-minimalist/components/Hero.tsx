"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HeroProps } from "@/lib/types";
import { SmartImage } from "@/components/SmartImage";
import { briefTransition } from "@/components/Reveal";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function Hero({ anchorId, variant, title, eyebrow, subtitle, tagline, primaryCta, secondaryCta, image, stats, showScrollIndicator }: HeroProps) {
  const reduce = useReducedMotion();
  const fade = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: briefTransition(delay) });
  const hasPhoto = Boolean(image && !image.placeholder);
  const split = variant !== "centered" && hasPhoto;

  const ctas = (
    <div className="flex flex-wrap items-center gap-8">
      {primaryCta ? (
        <a {...linkAttrs(primaryCta.href)} className="skin-btn min-h-11 text-base">
          {primaryCta.label} →
        </a>
      ) : null}
      {secondaryCta ? (
        <a {...linkAttrs(secondaryCta.href)} className="min-label min-h-11 content-center text-muted-foreground hover:text-foreground">
          {secondaryCta.label}
        </a>
      ) : null}
    </div>
  );

  if (!split) {
    return (
      <section id={anchorId} className="relative flex min-h-[92svh] flex-col items-center justify-center px-6 pb-16 pt-28 text-center">
        {eyebrow ? (
          <motion.p {...fade(0)} className="skin-eyebrow mb-8">
            {eyebrow}
          </motion.p>
        ) : null}
        <motion.h1 {...fade(0.1)} className="font-display text-[clamp(3.5rem,15vw,13rem)] font-extralight leading-[0.9] tracking-[-0.04em]">
          {title}
        </motion.h1>
        {tagline ? (
          <motion.p {...fade(0.2)} className="mt-8 text-lg font-light text-muted-foreground md:text-xl">
            {tagline}
          </motion.p>
        ) : null}
        {subtitle ? (
          <motion.p {...fade(0.25)} className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </motion.p>
        ) : null}
        <motion.div {...fade(0.35)} className="mt-12 flex justify-center">
          {ctas}
        </motion.div>
        {showScrollIndicator ? <span className="min-rule absolute bottom-10 left-1/2 h-16 w-px -translate-x-1/2 bg-border" aria-hidden /> : null}
      </section>
    );
  }

  return (
    <section id={anchorId} className="skin-container grid min-h-[100svh] grid-cols-1 gap-12 pb-16 pt-28 md:grid-cols-12 md:items-end md:gap-8">
      <div className="flex flex-col gap-8 md:col-span-5 md:pb-6">
        {eyebrow ? (
          <motion.p {...fade(0)} className="skin-eyebrow">
            {eyebrow}
          </motion.p>
        ) : null}
        <motion.h1 {...fade(0.1)} className="font-display text-[clamp(3.5rem,9vw,8.5rem)] font-extralight leading-[0.9] tracking-[-0.04em]">
          {title}
        </motion.h1>
        {tagline ? (
          <motion.p {...fade(0.2)} className="text-lg font-light">
            {tagline}
          </motion.p>
        ) : null}
        {subtitle ? (
          <motion.p {...fade(0.25)} className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </motion.p>
        ) : null}
        <motion.div {...fade(0.3)}>{ctas}</motion.div>
        {stats?.length ? (
          <motion.dl {...fade(0.4)} className="grid grid-cols-3 gap-4 border-t border-border pt-6">
            {stats.slice(0, 3).map((s) => (
              <div key={s.id}>
                <dd className="font-display text-3xl font-extralight tabular-nums">{s.value}</dd>
                <dt className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </motion.dl>
        ) : null}
      </div>
      <motion.div {...fade(0.15)} className="relative md:col-span-6 md:col-start-7">
        <div className="skin-media relative aspect-[4/5] w-full border border-border">
          {image ? <SmartImage image={image} fill priority sizes="(min-width: 768px) 50vw, 100vw" /> : null}
        </div>
        {image?.credit ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            {t("photoCredit")}: {image.credit}
          </p>
        ) : null}
      </motion.div>
    </section>
  );
}
