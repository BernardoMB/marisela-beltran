"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef, useState } from "react";
import type { Album, DiscographyProps } from "@/lib/types";
import { SmartImage } from "@/components/SmartImage";
import { albumTypeLabel, t } from "@/lib/i18n";
import { cn, linkAttrs } from "@/lib/utils";

function Cover({ album, className, sizes }: { album: Album; className?: string; sizes: string }) {
  const href = album.links.appleMusic ?? album.links.deezer ?? album.links.spotify;
  const inner = (
    <div className={cn("skin-media relative aspect-square w-full overflow-hidden bg-surface", className)}>
      {album.cover ? <SmartImage image={album.cover} fill sizes={sizes} /> : null}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent p-4 pt-12">
        <p className="font-display text-xl uppercase leading-none text-white md:text-2xl">{album.title}</p>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">
          {album.year ?? ""} {album.type !== "album" ? `· ${albumTypeLabel(album.type)}` : ""}
        </p>
      </div>
    </div>
  );
  return href ? (
    <a {...linkAttrs(href)} aria-label={`${album.title}${album.year ? ` (${album.year})` : ""}`} className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}

export default function Discography({ anchorId, title, eyebrow, intro, albums, layout = "carousel", limit }: DiscographyProps) {
  const reduce = useReducedMotion();
  const track = useRef<HTMLUListElement>(null);
  const [all, setAll] = useState(false);
  const scroll = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: "smooth" });
  const highlight = albums.find((a) => a.highlight) ?? albums[0];
  const rest = albums.filter((a) => a !== highlight);
  const gridList = all ? rest : rest.slice(0, (limit ?? 12) - 1);

  return (
    <section id={anchorId} className="skin-section overflow-hidden">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-6 px-5 md:px-10">
        <div>
          {eyebrow ? <p className="skin-eyebrow">{eyebrow}</p> : null}
          <h2 className="skin-title">{title}</h2>
          {intro ? <p className="skin-lead mt-4 max-w-xl">{intro}</p> : null}
        </div>
        {layout === "carousel" && albums.length > 3 ? (
          <div className="flex gap-3">
            <button type="button" onClick={() => scroll(-1)} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-foreground/40 transition hover:border-accent hover:text-accent" aria-label={t("previous")}>
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" onClick={() => scroll(1)} className="skin-btn flex h-14 w-14 items-center justify-center" aria-label={t("next")}>
              <ArrowRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
      {albums.length === 0 ? (
        <p className="skin-lead mx-auto mt-10 max-w-[1440px] px-5 md:px-10">{t("emptyAlbums")}</p>
      ) : layout === "carousel" ? (
        <ul ref={track} className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-10 pt-4 [scrollbar-width:none] md:px-10">
          {albums.map((a, i) => (
            <motion.li
              key={a.id}
              className="w-[70vw] shrink-0 snap-start sm:w-[22rem]"
              style={{ rotate: reduce ? 0 : i % 2 === 0 ? -3 : 3 }}
              whileHover={reduce ? undefined : { rotate: 0, scale: 1.04, transition: { type: "spring", stiffness: 260, damping: 16 } }}
            >
              <Cover album={a} sizes="(min-width: 640px) 22rem, 70vw" />
            </motion.li>
          ))}
        </ul>
      ) : (
        <div className="mx-auto mt-12 max-w-[1440px] px-5 md:px-10">
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {highlight ? (
              <li className="col-span-2 row-span-2">
                <Cover album={highlight} sizes="(min-width: 768px) 50vw, 100vw" className="ring-4 ring-accent" />
              </li>
            ) : null}
            {gridList.map((a) => (
              <li key={a.id}>
                <Cover album={a} sizes="(min-width: 768px) 25vw, 50vw" />
              </li>
            ))}
          </ul>
          {rest.length > gridList.length || all ? (
            <button type="button" onClick={() => setAll((v) => !v)} className="skin-btn mt-10 h-14 px-8 text-sm" aria-expanded={all}>
              {all ? t("readLess") : `${t("viewAll")} (${albums.length})`}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
