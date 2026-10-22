"use client";

import { useState } from "react";
import type { DiscographyProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { SmartImage } from "@/components/SmartImage";
import { albumTypeLabel, t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function Discography({ anchorId, title, eyebrow, intro, albums, layout = "timeline", limit }: DiscographyProps) {
  const initial = limit ?? 10;
  const [all, setAll] = useState(false);
  const list = all ? albums : albums.slice(0, initial);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} />
        {albums.length === 0 ? (
          <p className="skin-lead">{t("emptyAlbums")}</p>
        ) : layout === "list" ? (
          <ol className="mx-auto max-w-3xl">
            {list.map((a, i) => {
              const href = a.links.appleMusic ?? a.links.deezer;
              return (
                <li key={a.id} className="flex items-baseline gap-3 py-2 font-display text-xl md:text-2xl">
                  <span className="w-8 text-sm text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  {href ? (
                    <a {...linkAttrs(href)} className="italic hover:text-accent">
                      {a.title}
                    </a>
                  ) : (
                    <span className="italic">{a.title}</span>
                  )}
                  <span className="ed-leader" aria-hidden />
                  <span className="text-base tabular-nums">{a.year ?? "s/f"}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <ol className="relative ml-4 border-l border-foreground/40 md:ml-[calc(25%+1rem)]">
            {list.map((a, i) => {
              const href = a.links.appleMusic ?? a.links.deezer;
              return (
                <li key={a.id} className="relative pb-12 pl-8 md:pl-12">
                  <span className="absolute -left-[7px] top-3 h-3 w-3 rounded-full border-2 border-background bg-accent" aria-hidden />
                  <Reveal delay={(i % 3) * 0.05} className="grid gap-5 sm:grid-cols-[8rem_1fr] sm:items-start">
                    {a.cover ? (
                      <div className="relative aspect-square w-32 overflow-hidden shadow-none">
                        <SmartImage image={a.cover} fill sizes="128px" />
                      </div>
                    ) : null}
                    <div>
                      <p className="font-display text-5xl italic leading-none text-accent">{a.year ?? "—"}</p>
                      <h3 className="mt-2 font-display text-2xl font-bold md:text-3xl">{href ? <a {...linkAttrs(href)} className="hover:underline">{a.title}</a> : a.title}</h3>
                      <p className="ed-smallcaps mt-1 text-sm text-muted-foreground">
                        {albumTypeLabel(a.type)}
                        {a.trackCount ? ` · ${a.trackCount} ${t("tracks")}` : ""}
                        {a.highlight ? ` · ${t("debut")}` : ""}
                      </p>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        )}
        {albums.length > initial ? (
          <div className="mt-4 text-center">
            <button type="button" onClick={() => setAll((v) => !v)} className="skin-btn min-h-11" aria-expanded={all}>
              {all ? t("readLess") : `${t("viewAll")} (${albums.length})`}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
