"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import type { TopSongsProps } from "@/lib/types";
import { t } from "@/lib/i18n";
import { cn, formatDuration, take } from "@/lib/utils";
import { useAudioPreview } from "@/lib/use-audio-preview";

export default function TopSongs({ anchorId, title, eyebrow, intro, songs, limit, showStats }: TopSongsProps) {
  const reduce = useReducedMotion();
  const { playingId, progress, toggle } = useAudioPreview();
  const list = take(songs, limit ?? 10);
  return (
    <section id={anchorId} className="skin-section">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        {eyebrow ? <p className="skin-eyebrow">{eyebrow}</p> : null}
        <h2 className="skin-title bold-gradient-text">{title}</h2>
        {intro ? <p className="skin-lead mt-4 max-w-xl">{intro}</p> : null}
        {list.length === 0 ? (
          <p className="skin-lead mt-8">{t("emptySongs")}</p>
        ) : (
          <ol className="mt-12 grid gap-5 md:grid-cols-2">
            {list.map((s, i) => {
              const playing = playingId === s.id;
              return (
                <motion.li
                  key={s.id}
                  initial={reduce ? undefined : { opacity: 0, y: 50, rotate: i % 2 ? 2 : -2 }}
                  whileInView={reduce ? undefined : { opacity: 1, y: 0, rotate: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ type: "spring", stiffness: 140, damping: 15, delay: (i % 2) * 0.08 }}
                  className={cn("skin-card relative flex items-center gap-5 overflow-hidden p-5 md:p-6", playing && "ring-2 ring-accent")}
                >
                  <span className="bold-gradient-text w-20 shrink-0 font-display text-6xl leading-none md:w-24 md:text-7xl">{String(s.rank).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xl font-extrabold uppercase">{s.title}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[s.album, showStats && s.streams ? `${s.streams} ${t("streams")}` : formatDuration(s.durationSec)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {s.previewUrl ? (
                    <button type="button" onClick={() => toggle(s.id, s.previewUrl)} className="skin-btn flex h-14 w-14 shrink-0 items-center justify-center" aria-label={`${playing ? t("stopPreview") : t("playPreview")}: ${s.title}`} aria-pressed={playing}>
                      {playing ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="ml-0.5 h-5 w-5" aria-hidden />}
                    </button>
                  ) : null}
                  {playing ? <span className="absolute bottom-0 left-0 h-1.5 bg-linear-to-r from-gradient-from to-gradient-to" style={{ width: `${Math.round(progress * 100)}%` }} aria-hidden /> : null}
                </motion.li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
