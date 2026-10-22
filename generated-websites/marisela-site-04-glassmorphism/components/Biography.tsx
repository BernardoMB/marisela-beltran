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
    <section id={anchorId} className="skin-section px-4 md:px-8">
      <Reveal className="glass mx-auto grid max-w-[1280px] gap-10 p-6 md:p-12 lg:grid-cols-[22rem_1fr]">
        <div className="flex flex-col gap-6">
          {image ? (
            <div className="glass p-2">
              <div className="skin-media relative aspect-[4/5] w-full overflow-hidden">
                <SmartImage image={image} fill sizes="(min-width: 1024px) 22rem, 90vw" />
              </div>
            </div>
          ) : null}
          {facts?.length ? (
            <ul className="flex flex-wrap gap-2">
              {facts.map((f) => (
                <li key={f.label} className="skin-chip rounded-full px-3 py-1.5 text-xs">
                  <span className="text-muted-foreground">{f.label} · </span>
                  {f.value}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          {eyebrow ? <p className="skin-eyebrow">{eyebrow}</p> : null}
          <h2 className="skin-title">{title}</h2>
          {lead ? <p className="mt-6 text-xl leading-relaxed text-foreground/90">{lead}</p> : null}
          <div className="mt-6 space-y-5 leading-[1.8] text-foreground/85">
            {visible.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {paragraphs.length > maxParagraphs ? (
            <button type="button" onClick={() => setExpanded((e) => !e)} className="skin-btn-ghost mt-8 h-11 px-6 text-sm" aria-expanded={expanded}>
              {expanded ? t("readLess") : t("readMore")}
            </button>
          ) : null}
          {sourceNote ? <p className="mt-6 text-xs text-muted-foreground">{sourceNote}</p> : null}
        </div>
      </Reveal>
    </section>
  );
}
