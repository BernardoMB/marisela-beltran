"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { PointerEvent } from "react";
import type { HeroProps } from "@/lib/types";
import { SmartImage } from "@/components/SmartImage";
import { briefTransition } from "@/components/Reveal";
import { cn, linkAttrs } from "@/lib/utils";

function Aurora() {
  return (
    <div className="aurora" aria-hidden>
      <span className="aurora-orb left-[-10vw] top-[-10vh] h-[60vh] w-[60vh] bg-gradient-from" />
      <span className="aurora-orb right-[-12vw] top-[20vh] h-[55vh] w-[55vh] bg-gradient-via [animation-delay:-9s]" />
      <span className="aurora-orb bottom-[-15vh] left-[25vw] h-[50vh] w-[50vh] bg-gradient-to [animation-delay:-17s]" />
    </div>
  );
}

export default function Hero({ anchorId, variant, title, eyebrow, subtitle, tagline, primaryCta, secondaryCta, image, stats }: HeroProps) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 120, damping: 14 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 120, damping: 14 });
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const blurIn = (d: number) => (reduce ? {} : { initial: { opacity: 0, y: 30, filter: "blur(12px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: briefTransition(d) });
  const hasPhoto = Boolean(image && !image.placeholder);

  const ctas = (
    <div className={cn("mt-10 flex flex-wrap gap-3", variant === "centered-orb" && "justify-center")}>
      {primaryCta ? (
        <a {...linkAttrs(primaryCta.href)} className="skin-btn inline-flex h-13 items-center px-7 py-3.5 font-semibold">
          {primaryCta.label}
        </a>
      ) : null}
      {secondaryCta ? (
        <a {...linkAttrs(secondaryCta.href)} className="skin-btn-ghost inline-flex h-13 items-center px-7 py-3.5 font-medium">
          {secondaryCta.label}
        </a>
      ) : null}
    </div>
  );

  if (variant === "centered-orb" || !hasPhoto) {
    return (
      <section id={anchorId} className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-5 pb-16 pt-32 text-center">
        <Aurora />
        <span className="absolute left-1/2 top-1/2 -z-0 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--primary)_0%,transparent_65%)] opacity-40 blur-2xl" aria-hidden />
        <div className="relative">
          {eyebrow ? (
            <motion.p {...blurIn(0)} className="skin-eyebrow justify-center">
              {eyebrow}
            </motion.p>
          ) : null}
          <motion.h1 {...blurIn(0.1)} className="font-display text-[clamp(4rem,13vw,11rem)] font-light leading-[0.95] tracking-[-0.04em]">
            {title}
          </motion.h1>
          {tagline ? (
            <motion.p {...blurIn(0.2)} className="mt-6 text-xl text-foreground/85 md:text-2xl">
              {tagline}
            </motion.p>
          ) : null}
          {subtitle ? (
            <motion.p {...blurIn(0.3)} className="mx-auto mt-4 max-w-xl text-muted-foreground">
              {subtitle}
            </motion.p>
          ) : null}
          <motion.div {...blurIn(0.4)}>{ctas}</motion.div>
        </div>
      </section>
    );
  }

  return (
    <section id={anchorId} className="relative min-h-[100svh] overflow-hidden px-5 pb-16 pt-32 md:px-8">
      <Aurora />
      <div className="mx-auto grid max-w-[1280px] items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
        <div>
          {eyebrow ? (
            <motion.p {...blurIn(0)} className="skin-eyebrow">
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" aria-hidden />
              {eyebrow}
            </motion.p>
          ) : null}
          <motion.h1 {...blurIn(0.1)} className="font-display text-[clamp(3.75rem,9vw,8rem)] font-light leading-[0.95] tracking-[-0.04em]">
            {title}
          </motion.h1>
          {tagline ? (
            <motion.p {...blurIn(0.2)} className="mt-6 text-xl text-foreground/90 md:text-2xl">
              {tagline}
            </motion.p>
          ) : null}
          {subtitle ? (
            <motion.p {...blurIn(0.3)} className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
              {subtitle}
            </motion.p>
          ) : null}
          <motion.div {...blurIn(0.4)}>{ctas}</motion.div>
        </div>
        <motion.div {...blurIn(0.25)} onPointerMove={onMove} onPointerLeave={() => (mx.set(0), my.set(0))} className="relative mx-auto w-full max-w-md [perspective:1200px]">
          <motion.div style={{ rotateX, rotateY }} className="glass p-3">
            <div className="skin-media relative aspect-[4/5] w-full overflow-hidden">
              {image ? <SmartImage image={image} fill priority sizes="(min-width: 1024px) 28rem, 90vw" /> : null}
            </div>
          </motion.div>
          {stats?.slice(0, 3).map((s, i) => (
            <motion.div
              key={s.id}
              initial={reduce ? undefined : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.12, duration: 0.6 }}
              className={cn(
                "glass absolute px-4 py-3 text-left",
                i === 0 && "-left-6 top-10 md:-left-14",
                i === 1 && "-right-4 top-1/2 md:-right-12",
                i === 2 && "-left-2 bottom-8 md:-left-10",
              )}
            >
              <p className="font-display text-2xl font-semibold leading-none">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
