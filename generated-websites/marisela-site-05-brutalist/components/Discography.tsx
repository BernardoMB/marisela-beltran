"use client";

import { useState } from "react";
import type { DiscographyProps } from "@/lib/types";
import { SectionHeading } from "@/components/SectionHeading";
import { SmartImage } from "@/components/SmartImage";
import { albumTypeLabel, t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

export default function Discography({ anchorId, title, eyebrow, intro, albums, layout = "list", limit }: DiscographyProps) {
  const initial = limit ?? 12;
  const [all, setAll] = useState(false);
  const list = all ? albums : albums.slice(0, initial);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} />
        {albums.length === 0 ? (
          <p className="border-[3px] border-foreground p-6 font-bold">NO DATA — {t("emptyAlbums")}</p>
        ) : layout === "grid" ? (
          <ul className="grid grid-cols-2 border-l-[3px] border-t-[3px] border-foreground sm:grid-cols-3 lg:grid-cols-6">
            {list.map((a) => {
              const href = a.links.appleMusic ?? a.links.deezer;
              const body = (
                <>
                  <div className="relative aspect-square w-full border-b-[3px] border-foreground">{a.cover ? <SmartImage image={a.cover} fill sizes="(min-width: 1024px) 16vw, 45vw" /> : null}</div>
                  <p className="truncate px-2 py-1.5 text-xs font-bold uppercase">
                    {a.year ?? "----"} / {a.title}
                  </p>
                </>
              );
              return (
                <li key={a.id} className="brut-invert border-b-[3px] border-r-[3px] border-foreground">
                  {href ? (
                    <a {...linkAttrs(href)} className="block" aria-label={a.title}>
                      {body}
                    </a>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="brut-table min-w-[36rem] text-sm">
              <thead>
                <tr>
                  <th scope="col" className="w-16">
                    No.
                  </th>
                  <th scope="col" className="w-20">
                    AÑO
                  </th>
                  <th scope="col">TÍTULO</th>
                  <th scope="col" className="w-36">
                    TIPO
                  </th>
                  <th scope="col" className="w-28">
                    LINK
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((a, i) => {
                  const href = a.links.appleMusic ?? a.links.deezer;
                  return (
                    <tr key={a.id} className={a.highlight ? "bg-accent text-accent-foreground" : "brut-invert"}>
                      <td className="tabular-nums">{String(i + 1).padStart(3, "0")}</td>
                      <td className="tabular-nums">{a.year ?? "----"}</td>
                      <td className="font-bold uppercase">{a.title}</td>
                      <td className="uppercase">{albumTypeLabel(a.type)}</td>
                      <td>
                        {href ? (
                          <a {...linkAttrs(href)} className="inline-flex min-h-11 items-center font-bold underline decoration-2">
                            [{t("listen").toUpperCase()}]
                          </a>
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
        {albums.length > initial ? (
          <button type="button" onClick={() => setAll((v) => !v)} className="skin-btn mt-6 min-h-12 px-6" aria-expanded={all}>
            [{all ? t("readLess") : `${t("viewAll")} ${albums.length}`}]
          </button>
        ) : null}
      </div>
    </section>
  );
}
