"use client";

import { useState } from "react";
import type { DiscographyProps } from "@/lib/types";
import { BrandIcon } from "@/components/BrandIcons";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { SmartImage } from "@/components/SmartImage";
import { albumTypeLabel, t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function Discography({ anchorId, title, eyebrow, intro, albums, layout = "grid", limit, showTypes = true }: DiscographyProps) {
  const initial = limit ?? 12;
  const [all, setAll] = useState(false);
  const list = all ? albums : albums.slice(0, initial);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} />
        {albums.length === 0 ? (
          <p className="skin-lead">{t("emptyAlbums")}</p>
        ) : layout === "list" ? (
          <ol className="border-b border-border">
            {list.map((a) => (
              <li key={a.id} className="grid grid-cols-[4rem_1fr_auto] items-baseline gap-4 border-t border-border py-4 md:grid-cols-[6rem_1fr_10rem_auto]">
                <span className="text-sm tabular-nums text-muted-foreground">{a.year ?? "—"}</span>
                <span className="font-display text-xl font-light md:text-2xl">{a.title}</span>
                {showTypes ? <span className="hidden text-[11px] uppercase tracking-[0.2em] text-muted-foreground md:block">{albumTypeLabel(a.type)}</span> : null}
                <span className="flex gap-3">
                  {a.links.appleMusic ? (
                    <a {...linkAttrs(a.links.appleMusic)} aria-label={`${a.title} — Apple Music`} className="flex h-11 w-6 items-center text-muted-foreground hover:text-accent">
                      <BrandIcon platform="apple-music" className="h-4 w-4" />
                    </a>
                  ) : null}
                  {a.links.deezer ? (
                    <a {...linkAttrs(a.links.deezer)} aria-label={`${a.title} — Deezer`} className="flex h-11 w-6 items-center text-muted-foreground hover:text-accent">
                      <BrandIcon platform="deezer" className="h-4 w-4" />
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((a, i) => {
              const href = a.links.appleMusic ?? a.links.deezer ?? a.links.spotify;
              const cover = a.cover ? (
                <div className="skin-media relative aspect-square w-full bg-muted">
                  <SmartImage image={a.cover} fill sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw" />
                </div>
              ) : null;
              return (
                <li key={a.id}>
                  <Reveal delay={(i % 4) * 0.06}>
                    {href ? (
                      <a {...linkAttrs(href)} className="block" aria-label={`${a.title}${a.year ? ` (${a.year})` : ""}`}>
                        {cover}
                      </a>
                    ) : (
                      cover
                    )}
                    <p className="mt-3 text-sm leading-snug">{a.title}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground tabular-nums">
                      {a.year ?? ""}
                      {showTypes && a.type !== "album" ? ` · ${albumTypeLabel(a.type)}` : ""}
                    </p>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        )}
        {albums.length > initial ? (
          <button type="button" onClick={() => setAll((v) => !v)} className="skin-btn mt-12 min-h-11" aria-expanded={all}>
            {all ? t("readLess") : `${t("viewAll")} (${albums.length})`}
          </button>
        ) : null}
      </div>
    </section>
  );
}
