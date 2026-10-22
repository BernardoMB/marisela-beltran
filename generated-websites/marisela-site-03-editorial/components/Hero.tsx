"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HeroProps } from "@/lib/types";
import { briefTransition } from "@/components/Reveal";
import { SmartImage } from "@/components/SmartImage";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function Hero({ anchorId, variant, title, eyebrow, subtitle, tagline, primaryCta, secondaryCta, image, stats }: HeroProps) {
  const reduce = useReducedMotion();
  const hasPhoto = Boolean(image && !image.placeholder);
  const wipe = reduce ? {} : { initial: { clipPath: "inset(0 0 100% 0)" }, animate: { clipPath: "inset(0 0 0% 0)" }, transition: briefTransition(0.1) };
  const fade = (d: number) => (reduce ? {} : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: briefTransition(d) });

  if (variant !== "feature" && hasPhoto && image) {
    return (
      <section id={anchorId} className="relative isolate min-h-[92svh] overflow-hidden text-white">
        <motion.div {...wipe} className="absolute inset-0 -z-10">
          <SmartImage image={image} fill priority sizes="100vw" className="object-[50%_30%]" />
          <div className="absolute inset-0 bg-linear-to-b from-black/45 via-black/10 to-black/75" />
        </motion.div>
        <div className="skin-container flex min-h-[92svh] flex-col justify-between py-8">
          <div>
            <motion.p {...fade(0)} className="ed-smallcaps border-b border-white/60 pb-2 text-sm tracking-[0.3em]">
              {eyebrow ?? tagline}
            </motion.p>
            <motion.h1 {...fade(0.15)} className="mt-2 font-display text-[clamp(4.5rem,17vw,15rem)] font-black italic leading-[0.85] tracking-[-0.02em]">
              {title}
            </motion.h1>
          </div>
          <div className="grid gap-8 md:grid-cols-12 md:items-end">
            <motion.div {...fade(0.35)} className="md:col-span-6">
              {tagline ? <p className="font-display text-3xl italic leading-tight md:text-4xl">{tagline}</p> : null}
              {subtitle ? <p className="mt-4 max-w-lg text-lg leading-relaxed text-white/90">{subtitle}</p> : null}
              <div className="mt-6 flex flex-wrap gap-8">
                {primaryCta ? (
                  <a {...linkAttrs(primaryCta.href)} className="ed-smallcaps min-h-11 border-b-2 border-white pb-1 text-lg">
                    {primaryCta.label} →
                  </a>
                ) : null}
                {secondaryCta ? (
                  <a {...linkAttrs(secondaryCta.href)} className="ed-smallcaps min-h-11 pb-1 text-lg text-white/85 hover:text-white">
                    {secondaryCta.label}
                  </a>
                ) : null}
              </div>
            </motion.div>
            {stats?.length ? (
              <motion.ul {...fade(0.45)} className="space-y-2 border-l border-white/50 pl-6 md:col-span-4 md:col-start-9">
                {stats.slice(0, 3).map((s) => (
                  <li key={s.id} className="font-display text-xl italic">
                    {s.value} <span className="ed-smallcaps text-sm not-italic text-white/80">{s.label}</span>
                  </li>
                ))}
              </motion.ul>
            ) : null}
          </div>
          {image.credit ? <p className="ed-caption absolute bottom-3 right-5 text-white/70">{`${t("photoCredit")}: ${image.credit}`}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section id={anchorId} className="skin-container grid gap-10 py-14 md:grid-cols-12 md:py-20">
      <div className="md:col-span-7">
        {eyebrow ? (
          <motion.p {...fade(0)} className="skin-eyebrow">
            {eyebrow}
          </motion.p>
        ) : null}
        <motion.h1 {...fade(0.1)} className="font-display text-[clamp(4rem,12vw,11rem)] font-black italic leading-[0.86]">
          {title}
        </motion.h1>
        {tagline ? (
          <motion.p {...fade(0.2)} className="mt-6 font-display text-3xl italic text-accent">
            {tagline}
          </motion.p>
        ) : null}
        {subtitle ? (
          <motion.p {...fade(0.3)} className="ed-dropcap mt-6 max-w-xl text-xl leading-relaxed">
            {subtitle}
          </motion.p>
        ) : null}
        <motion.div {...fade(0.4)} className="mt-8 flex gap-8">
          {primaryCta ? (
            <a {...linkAttrs(primaryCta.href)} className="skin-btn min-h-11">
              {primaryCta.label} →
            </a>
          ) : null}
          {secondaryCta ? (
            <a {...linkAttrs(secondaryCta.href)} className="skin-btn-ghost min-h-11">
              {secondaryCta.label}
            </a>
          ) : null}
        </motion.div>
      </div>
      {image ? (
        <motion.figure {...wipe} className="md:col-span-5 md:pt-24">
          <div className="relative aspect-[3/4] w-full overflow-hidden">
            <SmartImage image={image} fill priority sizes="(min-width: 768px) 40vw, 100vw" />
          </div>
          {image.credit ? <figcaption className="ed-caption mt-2 border-t border-border pt-2">{`${image.alt} — ${t("photoCredit")}: ${image.credit}`}</figcaption> : null}
        </motion.figure>
      ) : null}
    </section>
  );
}
