"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { Album, DiscographyProps } from "@/lib/types";
import { SectionHeading } from "@/components/SectionHeading";
import { SmartImage } from "@/components/SmartImage";
import { albumTypeLabel, t } from "@/lib/i18n";
import { cn, linkAttrs } from "@/lib/utils";

function Card({ a, reduce, className }: { a: Album; reduce: boolean | null; className?: string }) {
  const href = a.links.appleMusic ?? a.links.deezer ?? a.links.spotify;
  const body = (
    <motion.div whileHover={reduce ? undefined : { y: -8, boxShadow: "0 24px 60px -20px var(--glow)" }} transition={{ duration: 0.35 }} className={cn("glass h-full p-3", className)}>
      <div className="skin-media relative aspect-square w-full overflow-hidden bg-foreground/5">{a.cover ? <SmartImage image={a.cover} fill sizes="(min-width: 1024px) 18rem, 45vw" /> : null}</div>
      <div className="px-2 pb-1 pt-3">
        <p className="truncate font-medium">{a.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {a.year ?? ""}
          {a.type !== "album" ? ` · ${albumTypeLabel(a.type)}` : ""}
        </p>
      </div>
    </motion.div>
  );
  return href ? (
    <a {...linkAttrs(href)} className="block h-full" aria-label={`${a.title}${a.year ? ` (${a.year})` : ""}`}>
      {body}
    </a>
  ) : (
    body
  );
}

export default function Discography({ anchorId, title, eyebrow, intro, albums, layout = "grid", limit }: DiscographyProps) {
  const reduce = useReducedMotion();
  const initial = limit ?? 8;
  const [all, setAll] = useState(false);
  const list = all ? albums : albums.slice(0, initial);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} />
        {albums.length === 0 ? (
          <p className="skin-lead">{t("emptyAlbums")}</p>
        ) : layout === "carousel" ? (
          <ul className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 [scrollbar-width:thin]">
            {albums.map((a) => (
              <li key={a.id} className="w-64 shrink-0 snap-start">
                <Card a={a} reduce={reduce} />
              </li>
            ))}
          </ul>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
              {list.map((a, i) => (
                <motion.li
                  key={a.id}
                  initial={reduce ? undefined : { opacity: 0, y: 30, filter: "blur(10px)" }}
                  whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.7, delay: (i % 4) * 0.07 }}
                >
                  <Card a={a} reduce={reduce} />
                </motion.li>
              ))}
            </ul>
            {albums.length > initial ? (
              <div className="mt-10 flex justify-center">
                <button type="button" onClick={() => setAll((v) => !v)} className="skin-btn-ghost h-12 px-8 text-sm" aria-expanded={all}>
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
