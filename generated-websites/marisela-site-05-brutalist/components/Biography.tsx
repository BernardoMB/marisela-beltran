"use client";

import { useState } from "react";
import type { BiographyProps } from "@/lib/types";
import { SmartImage } from "@/components/SmartImage";
import { t } from "@/lib/i18n";

export default function Biography({ anchorId, title, eyebrow, lead, paragraphs, facts, image, sourceNote, maxParagraphs = 3 }: BiographyProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? paragraphs : paragraphs.slice(0, maxParagraphs);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <div className="skin-card">
          <div className="flex items-center justify-between border-b-[3px] border-foreground bg-foreground px-4 py-2 text-background">
            <p className="text-sm font-bold">{eyebrow ?? "BIO.TXT"}</p>
            <p className="text-sm" aria-hidden>
              [_] [□] [X]
            </p>
          </div>
          <div className="grid lg:grid-cols-[1fr_20rem]">
            <div className="p-5 md:p-8">
              <h2 className="skin-title">{title}</h2>
              {lead ? <p className="mt-5 bg-accent px-3 py-2 text-base font-semibold text-accent-foreground">{lead}</p> : null}
              <div className="mt-6 space-y-4 text-[15px] leading-7">
                {visible.map((p, i) => (
                  <p key={i}>
                    <span className="mr-2 select-none text-muted-foreground">{String(i + 1).padStart(3, "0")}</span>
                    {p}
                  </p>
                ))}
              </div>
              {paragraphs.length > maxParagraphs ? (
                <button type="button" onClick={() => setExpanded((e) => !e)} className="skin-btn-ghost mt-6 min-h-11 px-4 text-sm" aria-expanded={expanded}>
                  [{expanded ? t("readLess") : t("readMore")}]
                </button>
              ) : null}
              {sourceNote ? <p className="mt-6 text-xs text-muted-foreground">// {sourceNote}</p> : null}
            </div>
            <aside className="border-t-[3px] border-foreground lg:border-l-[3px] lg:border-t-0">
              {image ? (
                <div className="relative aspect-square w-full border-b-[3px] border-foreground">
                  <SmartImage image={image} fill sizes="(min-width: 1024px) 20rem, 100vw" />
                </div>
              ) : null}
              {facts?.length ? (
                <dl className="p-4 text-sm">
                  {facts.map((f) => (
                    <div key={f.label} className="flex flex-wrap gap-x-2 border-b border-foreground py-2 last:border-0">
                      <dt className="font-bold uppercase">{f.label}:</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
