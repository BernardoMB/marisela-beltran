"use client";

import { useState } from "react";
import type { BiographyProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { SmartImage } from "@/components/SmartImage";
import { t } from "@/lib/i18n";

export default function Biography({ anchorId, title, eyebrow, lead, paragraphs, facts, image, sourceNote, maxParagraphs = 3 }: BiographyProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? paragraphs : paragraphs.slice(0, maxParagraphs);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} />
        <div className="grid gap-12 md:grid-cols-4 md:gap-8">
          <aside className="flex flex-col gap-8 md:col-span-1">
            {image ? (
              <div className="skin-media relative aspect-[3/4] w-full max-w-[16rem]">
                <SmartImage image={image} fill sizes="(min-width: 768px) 20vw, 60vw" />
              </div>
            ) : null}
            {facts?.length ? (
              <dl className="text-sm">
                {facts.map((f) => (
                  <div key={f.label} className="grid grid-cols-[1fr] gap-1 border-t border-border py-3">
                    <dt className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{f.label}</dt>
                    <dd className="font-light">{f.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </aside>
          <div className="md:col-span-3">
            {lead ? <p className="mb-10 max-w-3xl font-display text-2xl font-light leading-snug md:text-3xl">{lead}</p> : null}
            <div className="max-w-[65ch] space-y-6 text-[1.0625rem] font-light leading-[1.8]">
              {visible.map((p, i) => (
                <Reveal key={i} delay={i * 0.05}>
                  <p>{p}</p>
                </Reveal>
              ))}
            </div>
            {paragraphs.length > maxParagraphs ? (
              <button type="button" onClick={() => setExpanded((e) => !e)} className="skin-btn mt-8 min-h-11" aria-expanded={expanded}>
                {expanded ? t("readLess") : t("readMore")} {expanded ? "↑" : "↓"}
              </button>
            ) : null}
            {sourceNote ? <p className="mt-10 max-w-[65ch] text-xs text-muted-foreground">{sourceNote}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
