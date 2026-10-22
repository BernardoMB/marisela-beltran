"use client";

import { Pause, Play } from "lucide-react";
import type { TopSongsProps } from "@/lib/types";
import { SectionHeading } from "@/components/SectionHeading";
import { t } from "@/lib/i18n";
import { formatDuration, take } from "@/lib/utils";
import { useAudioPreview } from "@/lib/use-audio-preview";

export default function TopSongs({ anchorId, title, eyebrow, intro, songs, limit, showStats }: TopSongsProps) {
  const { playingId, progress, toggle } = useAudioPreview();
  const list = take(songs, limit ?? 10);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} />
        {list.length === 0 ? (
          <p className="skin-lead">{t("emptySongs")}</p>
        ) : (
          <ol className="border-b border-border md:ml-[25%]">
            {list.map((s) => {
              const playing = playingId === s.id;
              return (
                <li key={s.id} className="relative grid grid-cols-[2.5rem_1fr_auto_auto] items-center gap-4 border-t border-border py-4">
                  <span className="text-sm tabular-nums text-muted-foreground">{String(s.rank).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-light">{s.title}</span>
                    {s.album ? <span className="block truncate text-xs text-muted-foreground">{s.album}</span> : null}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">{showStats && s.streams ? s.streams : formatDuration(s.durationSec)}</span>
                  {s.previewUrl ? (
                    <button
                      type="button"
                      onClick={() => toggle(s.id, s.previewUrl)}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-border transition hover:border-foreground"
                      aria-label={`${playing ? t("stopPreview") : t("playPreview")}: ${s.title}`}
                      aria-pressed={playing}
                    >
                      {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="ml-0.5 h-3.5 w-3.5" aria-hidden />}
                    </button>
                  ) : (
                    <span className="w-11" />
                  )}
                  {playing ? <span className="absolute bottom-0 left-0 h-px bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} aria-hidden /> : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
