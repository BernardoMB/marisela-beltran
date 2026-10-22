"use client";

import type { TopSongsProps } from "@/lib/types";
import { SectionHeading } from "@/components/SectionHeading";
import { t } from "@/lib/i18n";
import { formatDuration, take } from "@/lib/utils";
import { useAudioPreview } from "@/lib/use-audio-preview";

export default function TopSongs({ anchorId, title, eyebrow, intro, songs, limit, showStats }: TopSongsProps) {
  const { playingId, toggle } = useAudioPreview();
  const list = take(songs, limit ?? 10);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} />
        {list.length === 0 ? (
          <p className="skin-lead">{t("emptySongs")}</p>
        ) : (
          <ol className="ed-columns md:columns-2">
            {list.map((s) => {
              const playing = playingId === s.id;
              return (
                <li key={s.id} className="mb-1 flex break-inside-avoid items-baseline gap-4 border-b border-border py-4">
                  <span className="font-display text-3xl italic text-accent tabular-nums">{s.rank}.</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-2xl leading-tight">{s.title}</span>
                    <span className="ed-caption">
                      {[s.album, showStats && s.streams ? `${s.streams} ${t("streams")}` : formatDuration(s.durationSec)].filter(Boolean).join(" — ")}
                    </span>
                  </span>
                  {s.previewUrl ? (
                    <button type="button" onClick={() => toggle(s.id, s.previewUrl)} className="ed-smallcaps min-h-11 shrink-0 text-sm hover:text-accent" aria-pressed={playing} aria-label={`${playing ? t("stopPreview") : t("playPreview")}: ${s.title}`}>
                      {playing ? `■ ${t("pause")}` : `▶ ${t("listen")}`}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
