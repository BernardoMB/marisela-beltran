"use client";

import { Pause, Play } from "lucide-react";
import type { TopSongsProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { t } from "@/lib/i18n";
import { cn, formatDuration, take } from "@/lib/utils";
import { useAudioPreview } from "@/lib/use-audio-preview";

export default function TopSongs({ anchorId, title, eyebrow, intro, songs, limit, showStats }: TopSongsProps) {
  const { playingId, progress, toggle } = useAudioPreview();
  const list = take(songs, limit ?? 10);
  const current = list.find((s) => s.id === playingId);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} />
        {list.length === 0 ? (
          <p className="skin-lead">{t("emptySongs")}</p>
        ) : (
          <Reveal className="glass mx-auto max-w-4xl p-3 md:p-5">
            <div className="flex items-center justify-between gap-4 rounded-[calc(var(--radius)-8px)] bg-linear-to-r from-gradient-from/40 via-gradient-via/30 to-gradient-to/40 px-5 py-4">
              <p className="text-sm text-foreground/90">{current ? `${t("play")}: ${current.title}` : t("playPreview")}</p>
              <span className="relative h-1.5 w-1/3 overflow-hidden rounded-full bg-white/15" aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-primary to-accent" style={{ width: `${current ? Math.round(progress * 100) : 0}%` }} />
              </span>
            </div>
            <ol className="mt-2">
              {list.map((s) => {
                const playing = playingId === s.id;
                return (
                  <li key={s.id} className={cn("flex items-center gap-4 rounded-2xl px-3 py-3 transition hover:bg-white/5 md:px-4", playing && "bg-white/10")}>
                    <span className="w-6 text-right text-sm tabular-nums text-muted-foreground">{s.rank}</span>
                    {s.previewUrl ? (
                      <button type="button" onClick={() => toggle(s.id, s.previewUrl)} className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition", playing ? "skin-btn" : "bg-white/10 hover:bg-white/20")} aria-label={`${playing ? t("stopPreview") : t("playPreview")}: ${s.title}`} aria-pressed={playing}>
                        {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="ml-0.5 h-4 w-4" aria-hidden />}
                      </button>
                    ) : (
                      <span className="w-11" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.title}</span>
                      {s.album ? <span className="block truncate text-xs text-muted-foreground">{s.album}</span> : null}
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">{showStats && s.streams ? s.streams : formatDuration(s.durationSec)}</span>
                  </li>
                );
              })}
            </ol>
          </Reveal>
        )}
      </div>
    </section>
  );
}
