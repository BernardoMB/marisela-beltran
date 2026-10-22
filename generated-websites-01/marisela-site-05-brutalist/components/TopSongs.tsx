"use client";

import type { TopSongsProps } from "@/lib/types";
import { SectionHeading } from "@/components/SectionHeading";
import { t } from "@/lib/i18n";
import { cn, formatDuration, take } from "@/lib/utils";
import { useAudioPreview } from "@/lib/use-audio-preview";

export default function TopSongs({ anchorId, title, eyebrow, intro, songs, limit, showStats }: TopSongsProps) {
  const { playingId, progress, toggle } = useAudioPreview();
  const list = take(songs, limit ?? 10);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} />
        {list.length === 0 ? (
          <p className="border-[3px] border-foreground p-6 font-bold">NO DATA — {t("emptySongs")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="brut-table min-w-[32rem] text-sm">
              <thead>
                <tr>
                  <th scope="col" className="w-12">
                    #
                  </th>
                  <th scope="col">TÍTULO</th>
                  <th scope="col" className="hidden md:table-cell">
                    ÁLBUM
                  </th>
                  <th scope="col" className="w-24">
                    {showStats && list.some((s) => s.streams) ? t("streams").toUpperCase() : "DUR"}
                  </th>
                  <th scope="col" className="w-28">
                    AUDIO
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const playing = playingId === s.id;
                  return (
                    <tr key={s.id} className={cn(playing ? "bg-foreground text-background" : "brut-invert")}>
                      <td className="tabular-nums">{String(s.rank).padStart(2, "0")}</td>
                      <td className="font-bold uppercase">{s.title}</td>
                      <td className="hidden uppercase md:table-cell">{s.album ?? "—"}</td>
                      <td className="tabular-nums">{showStats && s.streams ? s.streams : formatDuration(s.durationSec)}</td>
                      <td>
                        {s.previewUrl ? (
                          <button type="button" onClick={() => toggle(s.id, s.previewUrl)} className="min-h-11 font-bold" aria-pressed={playing} aria-label={`${playing ? t("stopPreview") : t("playPreview")}: ${s.title}`}>
                            {playing ? `[■ ${String(Math.round(progress * 100)).padStart(2, "0")}%]` : "[▶ PLAY]"}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
