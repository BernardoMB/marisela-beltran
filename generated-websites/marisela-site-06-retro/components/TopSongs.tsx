"use client";

import { Pause, Play } from "lucide-react";
import type { Song, TopSongsProps } from "@/lib/types";
import { SectionHeading } from "@/components/SectionHeading";
import { t } from "@/lib/i18n";
import { cn, formatDuration, take } from "@/lib/utils";
import { useAudioPreview } from "@/lib/use-audio-preview";

export default function TopSongs({ anchorId, title, eyebrow, intro, songs, limit, showStats }: TopSongsProps) {
  const { playingId, toggle } = useAudioPreview();
  const list = take(songs, limit ?? 10);
  const half = Math.ceil(list.length / 2);
  const sides: Array<[string, Song[]]> = [
    ["LADO A", list.slice(0, half)],
    ["LADO B", list.slice(half)],
  ];
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} />
        {list.length === 0 ? (
          <p className="skin-lead">{t("emptySongs")}</p>
        ) : (
          <div className="skin-card overflow-hidden p-0">
            <div className="retro-stripes h-4" aria-hidden />
            <div className="grid md:grid-cols-2">
              {sides.map(([label, side], si) => (
                <div key={label} className={cn("p-6 md:p-8", si === 1 && "border-t-2 border-dashed border-border md:border-l-2 md:border-t-0")}>
                  <p className="retro-mono mb-4 inline-block rounded-full border-2 border-border px-3 py-1 text-xs">{label}</p>
                  <ol className="space-y-1">
                    {side.map((s) => {
                      const playing = playingId === s.id;
                      return (
                        <li key={s.id} className={cn("flex items-center gap-3 rounded-[var(--radius-sm)] px-2 py-2", playing && "bg-secondary/40")}>
                          <span className="retro-mono w-7 text-sm text-muted-foreground">{String(s.rank).padStart(2, "0")}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold">{s.title}</span>
                            <span className="retro-mono block truncate text-[10px] text-muted-foreground">{showStats && s.streams ? `${s.streams} ${t("streams")}` : formatDuration(s.durationSec)}</span>
                          </span>
                          {s.previewUrl ? (
                            <button type="button" onClick={() => toggle(s.id, s.previewUrl)} className="skin-btn flex h-11 w-11 shrink-0 items-center justify-center" aria-label={`${playing ? t("stopPreview") : t("playPreview")}: ${s.title}`} aria-pressed={playing}>
                              {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="ml-0.5 h-4 w-4" aria-hidden />}
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
