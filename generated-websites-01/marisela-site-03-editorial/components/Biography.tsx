"use client";

import { useState } from "react";
import type { BiographyProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { SmartImage } from "@/components/SmartImage";
import { t } from "@/lib/i18n";

export default function Biography({ anchorId, title, eyebrow, lead, paragraphs, facts, image, sourceNote, maxParagraphs = 4 }: BiographyProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? paragraphs : paragraphs.slice(0, maxParagraphs);
  const pull = paragraphs.find((p) => p.length > 140)?.split(/(?<=[.!?])\s/)[0];
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <header className="grid gap-6 border-t-[3px] border-double border-foreground pt-6 md:grid-cols-12">
          <div className="md:col-span-8 md:col-start-2">
            {eyebrow ? <p className="skin-eyebrow">{eyebrow}</p> : null}
            <h2 className="font-display text-[clamp(2.75rem,6.5vw,5.75rem)] font-bold leading-[0.98]">{title}</h2>
            {lead ? <p className="skin-lead mt-6 max-w-3xl text-2xl">{lead}</p> : null}
          </div>
        </header>
        <div className="mt-12 grid gap-12 md:grid-cols-12">
          <aside className="md:col-span-3 md:col-start-1">
            {image ? (
              <figure className="mb-8">
                <div className="relative aspect-[4/5] w-full overflow-hidden">
                  <SmartImage image={image} fill sizes="(min-width: 768px) 25vw, 100vw" />
                </div>
                <figcaption className="ed-caption mt-2">{image.alt}</figcaption>
              </figure>
            ) : null}
            {facts?.length ? (
              <div className="border-t border-foreground pt-3">
                <p className="ed-smallcaps mb-2 text-lg text-accent">{t("moreInfo")}</p>
                <dl className="text-[0.95rem]">
                  {facts.map((f) => (
                    <div key={f.label} className="border-b border-border py-2">
                      <dt className="ed-smallcaps text-sm text-muted-foreground">{f.label}</dt>
                      <dd className="font-display italic">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </aside>
          <div className="md:col-span-8 md:col-start-5">
            <div className="ed-columns text-[1.15rem] leading-[1.7] lg:columns-2">
              {visible.map((p, i) => (
                <p key={i} className={`mb-5 break-inside-avoid-column ${i === 0 ? "ed-dropcap" : ""}`}>
                  {p}
                </p>
              ))}
            </div>
            {pull ? (
              <Reveal>
                <blockquote className="my-10 border-y border-accent py-6 text-center font-display text-3xl italic leading-snug text-accent md:text-4xl">“{pull}”</blockquote>
              </Reveal>
            ) : null}
            {paragraphs.length > maxParagraphs ? (
              <button type="button" onClick={() => setExpanded((e) => !e)} className="skin-btn min-h-11" aria-expanded={expanded}>
                {expanded ? t("readLess") : t("readMore")}
              </button>
            ) : null}
            {sourceNote ? <p className="ed-caption mt-8">{sourceNote}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
