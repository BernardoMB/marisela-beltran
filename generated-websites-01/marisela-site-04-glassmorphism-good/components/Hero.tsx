"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { PointerEvent, ReactNode } from "react";
import type { HeroProps } from "@/lib/types";
import { BackgroundVideo } from "@/components/BackgroundVideo";
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

/**
 * Full-viewport hero. With `backgroundVideoId` the section is exactly one viewport tall (.hero-viewport)
 * and a muted YouTube video covers it behind the content; the content is scoped to the dark palette
 * (data-theme="dark") so it stays legible over the footage in either site theme.
 */
function HeroShell({ anchorId, videoId, className, children }: { anchorId?: string; videoId?: string; className?: string; children: ReactNode }) {
  return (
    <>
      {/* Page-wide fixed backdrop; rendered outside the section so it stays behind every later section. */}
      <Aurora />
      <section
        id={anchorId}
        data-theme={videoId ? "dark" : undefined}
        className={cn("relative w-full overflow-hidden", videoId ? "hero-viewport text-foreground" : "min-h-[100svh]", className)}
      >
        {videoId ? (
          <>
            <BackgroundVideo youtubeId={videoId} className="z-0" />
            <div className="pointer-events-none absolute inset-0 z-0 bg-black/35 bg-linear-to-r from-black/55 via-black/20 to-transparent" aria-hidden />
          </>
        ) : null}
        {children}
      </section>
    </>
  );
}

export default function Hero({ anchorId, variant, title, eyebrow, subtitle, tagline, primaryCta, secondaryCta, image, stats, backgroundVideoId }: HeroProps) {
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
    <div className={cn("mt-8 flex flex-wrap gap-3 md:mt-10 short:mt-4", variant === "centered-orb" && "justify-center")}>
      {primaryCta ? (
        <a {...linkAttrs(primaryCta.href)} className="skin-btn inline-flex h-13 items-center px-7 py-3.5 font-semibold short:h-11 short:py-2.5">
          {primaryCta.label}
        </a>
      ) : null}
      {secondaryCta ? (
        <a {...linkAttrs(secondaryCta.href)} className="skin-btn-ghost inline-flex h-13 items-center px-7 py-3.5 font-medium short:h-11 short:py-2.5">
          {secondaryCta.label}
        </a>
      ) : null}
    </div>
  );

  if (variant === "centered-orb" || !hasPhoto) {
    return (
      <HeroShell anchorId={anchorId} videoId={backgroundVideoId} className="flex items-center justify-center px-5 pb-16 pt-32 text-center">
        <span className="absolute left-1/2 top-1/2 z-0 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--primary)_0%,transparent_65%)] opacity-40 blur-2xl" aria-hidden />
        <div className="relative z-10">
          {eyebrow ? (
            <motion.p {...blurIn(0)} className="skin-eyebrow justify-center">
              {eyebrow}
            </motion.p>
          ) : null}
          <motion.h1 {...blurIn(0.1)} className="font-display text-[clamp(4rem,min(13vw,16vh),11rem)] font-light leading-[0.95] tracking-[-0.04em]">
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
      </HeroShell>
    );
  }

  return (
    <HeroShell anchorId={anchorId} videoId={backgroundVideoId} className="flex flex-col px-5 pb-10 pt-28 md:px-8 md:pt-32 short:pb-4 short:pt-20">
      {/* Mobile: text, then the photo card in whatever height remains. Desktop: two columns. */}
      <div className="relative z-10 mx-auto grid min-h-0 w-full max-w-[1280px] flex-1 grid-rows-[auto_minmax(0,1fr)] items-center gap-8 lg:grid-cols-[1.1fr_1fr] lg:grid-rows-1 lg:gap-14">
        <div>
          {eyebrow ? (
            <motion.p {...blurIn(0)} className="skin-eyebrow">
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" aria-hidden />
              {eyebrow}
            </motion.p>
          ) : null}
          <motion.h1 {...blurIn(0.1)} className="font-display text-[clamp(2.5rem,min(9vw,13vh),8rem)] font-light leading-[0.95] tracking-[-0.04em]">
            {title}
          </motion.h1>
          {tagline ? (
            <motion.p {...blurIn(0.2)} className="mt-5 text-xl text-foreground/90 md:mt-6 md:text-2xl short:mt-2 short:text-base">
              {tagline}
            </motion.p>
          ) : null}
          {subtitle ? (
            <motion.p {...blurIn(0.3)} className="mt-4 max-w-lg leading-relaxed text-muted-foreground short:mt-2 short:text-sm">
              {subtitle}
            </motion.p>
          ) : null}
          <motion.div {...blurIn(0.4)}>{ctas}</motion.div>
        </div>
        {/* The card takes the remaining height (4:5, at most 36rem tall); it is dropped on short phone screens. */}
        <motion.div {...blurIn(0.25)} className="flex h-full min-h-0 items-center justify-center max-lg:[@media(max-height:640px)]:hidden">
          <div onPointerMove={onMove} onPointerLeave={() => (mx.set(0), my.set(0))} className="@container relative aspect-[4/5] h-full max-h-[36rem] max-w-full [perspective:1200px]">
            <motion.div style={{ rotateX, rotateY }} className="glass h-full p-3">
              <div className="skin-media relative h-full w-full overflow-hidden">
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
                  // Compact badges hugging the corners when the card is small (phones), floating offsets otherwise.
                  "glass absolute max-w-[60%] px-2.5 py-1.5 text-left @xs:max-w-none @xs:px-4 @xs:py-3",
                  i === 0 && "-left-3 top-4 @xs:-left-6 @xs:top-10 md:@xs:-left-14",
                  i === 1 && "-right-3 top-[45%] @xs:-right-4 @xs:top-1/2 md:@xs:-right-12",
                  i === 2 && "-left-3 bottom-4 @xs:-left-2 @xs:bottom-8 md:@xs:-left-10",
                )}
              >
                <p className="font-display text-base font-semibold leading-none @xs:text-2xl">{s.value}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground @xs:mt-1 @xs:text-xs">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </HeroShell>
  );
}
