"use client";

import { useState } from "react";
import type { BiographyProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { SmartImage } from "@/components/SmartImage";
import { t } from "@/lib/i18n";

export default function Biography({ anchorId, title, eyebrow, lead, paragraphs, facts, image, sourceNote, maxParagraphs = 3 }: BiographyProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? paragraphs : paragraphs.slice(0, maxParagraphs);
  return (
    <section id={anchorId} className="skin-section overflow-hidden">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        <Reveal>
          {eyebrow ? <p className="skin-eyebrow">{eyebrow}</p> : null}
          <h2 className="skin-title bold-gradient-text">{title}</h2>
        </Reveal>
        <div className="relative mt-10 rounded-[var(--radius-lg)] bg-linear-to-br from-gradient-from via-gradient-via to-gradient-to p-[3px] shadow-lg">
          <div className="grid gap-10 rounded-[calc(var(--radius-lg)-3px)] bg-background p-6 md:grid-cols-[1fr_2fr] md:p-12">
            <div className="flex flex-col gap-6">
              {image ? (
                <div className="skin-media relative aspect-square w-full rotate-[-3deg] overflow-hidden">
                  <SmartImage image={image} fill sizes="(min-width: 768px) 30vw, 90vw" />
                </div>
              ) : null}
              {facts?.length ? (
                <ul className="flex flex-wrap gap-2">
                  {facts.map((f, i) => (
                    <li key={f.label} className={`rounded-full px-4 py-2 text-xs font-bold ${i % 3 === 0 ? "bg-primary text-primary-foreground" : i % 3 === 1 ? "bg-secondary text-secondary-foreground" : "bg-accent text-accent-foreground"}`}>
                      <span className="opacity-80">{f.label}:</span> {f.value}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div>
              {lead ? <p className="font-display text-3xl uppercase leading-[0.95] md:text-5xl">{lead}</p> : null}
              <div className="mt-8 gap-10 space-y-5 text-[1.0625rem] leading-relaxed text-foreground/90 lg:columns-2 lg:space-y-0">
                {visible.map((p, i) => (
                  <p key={i} className="mb-5 break-inside-avoid">
                    {p}
                  </p>
                ))}
              </div>
              {paragraphs.length > maxParagraphs ? (
                <button type="button" onClick={() => setExpanded((e) => !e)} className="skin-btn mt-6 h-12 px-6 text-xs" aria-expanded={expanded}>
                  {expanded ? t("readLess") : t("readMore")}
                </button>
              ) : null}
              {sourceNote ? <p className="mt-6 text-xs text-muted-foreground">{sourceNote}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
