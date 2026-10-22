import type { TourDatesProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { LOCALE, eventStatusLabel, t } from "@/lib/i18n";
import { formatEventDate, linkAttrs } from "@/lib/utils";

export default function TourDates({ anchorId, title, eyebrow, intro, events, tourName, ticketsUrl, emptyTitle, emptyMessage, ctaLabel }: TourDatesProps) {
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro ?? tourName} />
        {events.length === 0 ? (
          <Reveal className="mx-auto max-w-2xl border-y-[3px] border-double border-foreground py-10 text-center">
            <p className="ed-smallcaps text-sm text-accent">{t("nextShow")}</p>
            <p className="mt-3 font-display text-3xl italic md:text-4xl">{emptyTitle}</p>
            <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed">{emptyMessage}</p>
            {ticketsUrl ? (
              <a {...linkAttrs(ticketsUrl)} className="skin-btn mt-6 inline-block min-h-11">
                {ctaLabel ?? t("tickets")} →
              </a>
            ) : null}
          </Reveal>
        ) : (
          <ol className="divide-y divide-border border-y border-foreground">
            {events.map((e) => {
              const d = formatEventDate(e.date, LOCALE);
              return (
                <li key={e.id} className="grid gap-2 py-6 md:grid-cols-12 md:items-baseline">
                  <p className="font-display text-3xl italic md:col-span-3">
                    {d.day} {d.month}
                    <span className="ed-caption block not-italic">{d.weekday}, {d.year}</span>
                  </p>
                  <p className="md:col-span-5">
                    <span className="ed-smallcaps block text-xl">{e.venue}</span>
                    <span className="text-muted-foreground">{[e.city, e.region, e.country].filter(Boolean).join(", ")}</span>
                  </p>
                  <p className="ed-caption md:col-span-2">{eventStatusLabel(e.status)}</p>
                  <p className="md:col-span-2 md:text-right">
                    {e.ticketUrl && e.status !== "sold-out" ? (
                      <a {...linkAttrs(e.ticketUrl)} className="skin-btn min-h-11">
                        {ctaLabel ?? t("tickets")}
                      </a>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
