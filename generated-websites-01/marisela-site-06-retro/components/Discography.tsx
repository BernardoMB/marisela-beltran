"use client";

import { useState } from "react";
import type { Album, DiscographyProps } from "@/lib/types";
import { SectionHeading } from "@/components/SectionHeading";
import { SmartImage } from "@/components/SmartImage";
import { albumTypeLabel, t } from "@/lib/i18n";
import { cn, linkAttrs } from "@/lib/utils";

/** A sleeve with its record: in the crate the vinyl peeks out sideways, in the grid it is pulled up out of the sleeve on hover. */
function Record({ album, sizes, crate }: { album: Album; sizes: string; crate: boolean }) {
  const href = album.links.appleMusic ?? album.links.deezer ?? album.links.spotify;
  const body = (
    <div className="group relative">
      <div
        className={cn(
          "retro-vinyl absolute aspect-square w-[92%] transition-[translate,rotate] duration-700 ease-out group-hover:rotate-[160deg]",
          crate ? "right-2 top-[4%] translate-x-[26%] group-hover:translate-x-[44%] group-focus-within:translate-x-[44%]" : "left-[4%] top-1 group-hover:-translate-y-[22%] group-focus-within:-translate-y-[22%]",
        )}
        aria-hidden
      />
      <div className="skin-media relative aspect-square w-full overflow-hidden bg-surface">
        {album.cover ? <SmartImage image={album.cover} fill sizes={sizes} /> : null}
        <span className="retro-stripes absolute bottom-0 left-0 h-2 w-full" aria-hidden />
      </div>
      <span className="retro-mono absolute -left-2 -top-3 flex h-14 w-14 rotate-[-10deg] items-center justify-center rounded-full border-2 border-border bg-secondary text-xs font-bold text-secondary-foreground shadow-sm">{album.year ?? "s/f"}</span>
    </div>
  );
  return (
    <figure>
      {href ? (
        <a {...linkAttrs(href)} aria-label={`${album.title}${album.year ? ` (${album.year})` : ""}`} className="block">
          {body}
        </a>
      ) : (
        body
      )}
      <figcaption className="mt-4">
        <p className="font-bold leading-snug">{album.title}</p>
        <p className="retro-mono text-[11px] text-muted-foreground">{albumTypeLabel(album.type)}</p>
      </figcaption>
    </figure>
  );
}

export default function Discography({ anchorId, title, eyebrow, intro, albums, layout = "carousel", limit }: DiscographyProps) {
  const initial = limit ?? 8;
  const [all, setAll] = useState(false);
  const list = all ? albums : albums.slice(0, initial);
  return (
    <section id={anchorId} className="skin-section overflow-hidden">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} />
        {albums.length === 0 ? (
          <p className="skin-lead">{t("emptyAlbums")}</p>
        ) : layout === "carousel" ? (
          <div className="skin-card overflow-hidden bg-muted p-0">
            <p className="retro-mono border-b-2 border-border bg-surface px-5 py-2 text-xs">
              ✦ {albums.length} {albumTypeLabel("album")}s ✦
            </p>
            <ul className="flex snap-x scroll-px-8 gap-6 overflow-x-auto px-8 pb-10 pt-8">
              {albums.map((a) => (
                <li key={a.id} className="w-56 shrink-0 snap-start pr-14 sm:w-64">
                  <Record album={a} crate sizes="13rem" />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4">
              {list.map((a, i) => (
                <li key={a.id} className={cn(i % 2 ? "md:translate-y-6" : "")}>
                  <Record album={a} crate={false} sizes="(min-width: 768px) 22vw, 45vw" />
                </li>
              ))}
            </ul>
            {albums.length > initial ? (
              <div className="mt-14 text-center">
                <button type="button" onClick={() => setAll((v) => !v)} className="skin-btn h-12 px-8" aria-expanded={all}>
                  {all ? t("readLess") : `${t("viewAll")} (${albums.length})`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
