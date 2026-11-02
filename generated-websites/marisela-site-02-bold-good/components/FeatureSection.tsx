"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { FeatureSectionProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { LOCALE, t } from "@/lib/i18n";
import { formatEventDate, linkAttrs } from "@/lib/utils";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function Countdown({ iso }: { iso: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const target = Date.parse(`${iso}T20:00:00`);
  const diff = now === null ? null : Math.max(0, target - now);
  const days = diff === null ? "—" : String(Math.floor(diff / 86_400_000));
  const hours = diff === null ? "—" : String(Math.floor((diff % 86_400_000) / 3_600_000)).padStart(2, "0");
  return (
    <p className="flex items-baseline gap-6 font-display text-5xl tabular-nums md:text-7xl" aria-live="polite">
      <span>
        {days} <span className="text-sm skin-muted">{t("days")}</span>
      </span>
      <span>
        {hours} <span className="text-sm skin-muted">{t("hours")}</span>
      </span>
    </p>
  );
}

/**
 * Generic section for union features without a dedicated component (merch, fan club, countdown,
 * news, lyrics…). Items come from real content; the countdown appears when the first item is a date.
 */
export default function FeatureSection({ anchorId, featureType, title, eyebrow, body, items, cta }: FeatureSectionProps) {
  const first = items?.[0];
  const countdownDate = featureType === "countdown" && first?.description && ISO_DATE.test(first.description) ? first.description : null;
  return (
    <section id={anchorId} className={`c-feature c-feature-${featureType} skin-section`} data-feature={featureType}>
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={body} />
        {countdownDate && first ? (
          <Reveal className="skin-card flex flex-col gap-4 p-8 md:p-12">
            <Countdown iso={countdownDate} />
            <p className="text-lg">{first.title}</p>
            <p className="text-sm skin-muted">{formatEventDate(countdownDate, LOCALE).full}</p>
          </Reveal>
        ) : items?.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => (
              <li key={`${item.title}-${i}`}>
                <Reveal delay={i * 0.05} className="skin-card flex h-full flex-col gap-2 p-6">
                  {item.href ? (
                    <a {...linkAttrs(item.href)} className="group inline-flex items-start justify-between gap-3 text-lg leading-snug">
                      <span>{item.title}</span>
                      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                    </a>
                  ) : (
                    <p className="text-lg leading-snug">{item.title}</p>
                  )}
                  {item.description ? <p className="text-sm skin-muted">{ISO_DATE.test(item.description) ? formatEventDate(item.description, LOCALE).full : item.description}</p> : null}
                </Reveal>
              </li>
            ))}
          </ul>
        ) : null}
        {cta ? (
          <p className="mt-10">
            <a {...linkAttrs(cta.href)} className="skin-btn inline-flex min-h-12 items-center gap-2 px-6">
              {cta.label}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
          </p>
        ) : null}
      </div>
    </section>
  );
}
