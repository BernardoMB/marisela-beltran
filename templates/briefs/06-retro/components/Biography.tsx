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
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        {eyebrow ? <p className="skin-eyebrow">{eyebrow}</p> : null}
        <h2 className="skin-title">{title}</h2>
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_20rem]">
          <Reveal className="skin-card p-6 md:p-10">
            {lead ? <p className="mb-6 text-xl font-bold italic leading-relaxed">{lead}</p> : null}
            <div className="space-y-5 text-[1.0625rem] leading-[1.8]">
              {visible.map((p, i) => (
                <p key={i} className={i === 0 ? "first-letter:float-left first-letter:mr-3 first-letter:font-display first-letter:text-7xl first-letter:leading-[0.8] first-letter:text-primary" : undefined}>
                  {p}
                </p>
              ))}
            </div>
            {paragraphs.length > maxParagraphs ? (
              <button type="button" onClick={() => setExpanded((e) => !e)} className="skin-btn mt-8 h-12 px-6 text-sm" aria-expanded={expanded}>
                {expanded ? t("readLess") : t("readMore")}
              </button>
            ) : null}
            {sourceNote ? <p className="mt-6 text-xs italic text-muted-foreground">{sourceNote}</p> : null}
          </Reveal>
          <div className="flex flex-col gap-10">
            {image ? (
              <figure className="relative mx-auto w-64 rotate-[3deg] border-2 border-border bg-surface p-3 pb-12 shadow-lg">
                <span className="absolute -top-3 left-1/2 h-7 w-24 -translate-x-1/2 rotate-[-4deg] bg-secondary/80" aria-hidden />
                <div className="relative aspect-square w-full overflow-hidden">
                  <SmartImage image={image} fill sizes="16rem" />
                </div>
                <figcaption className="retro-mono absolute bottom-3 left-0 w-full text-center text-[11px]">{image.alt.slice(0, 40)}</figcaption>
              </figure>
            ) : null}
            {facts?.length ? (
              <dl className="skin-card retro-mono p-5 text-xs">
                <p className="mb-3 border-b-2 border-dashed border-border pb-2 text-sm">FICHA · Nº 001</p>
                {facts.map((f) => (
                  <div key={f.label} className="flex flex-wrap justify-between gap-2 py-1.5">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="text-right font-bold normal-case">{f.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
