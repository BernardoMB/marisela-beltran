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
          <Reveal className="border-y border-border py-16 text-center md:ml-[25%]">
            <p className="font-display text-3xl font-extralight md:text-4xl">{emptyTitle}</p>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">{emptyMessage}</p>
            {ticketsUrl ? (
              <a {...linkAttrs(ticketsUrl)} className="skin-btn mt-8 inline-block min-h-11">
                {ctaLabel ?? t("tickets")} →
              </a>
            ) : null}
          </Reveal>
        ) : (
          <ol className="border-b border-border md:ml-[25%]">
            {events.map((e) => {
              const d = formatEventDate(e.date, LOCALE);
              return (
                <li key={e.id} className="grid grid-cols-[4.5rem_1fr] items-center gap-4 border-t border-border py-5 md:grid-cols-[6rem_1fr_9rem_8rem]">
                  <span className="tabular-nums">
                    <span className="block font-display text-3xl font-extralight leading-none">{d.day}</span>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      {d.monthShort} {d.year}
                    </span>
                  </span>
                  <span>
                    <span className="block text-lg font-light">{e.venue}</span>
                    <span className="text-sm text-muted-foreground">{[e.city, e.region, e.country].filter(Boolean).join(", ")}</span>
                  </span>
                  <span className="col-start-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground md:col-start-auto">{eventStatusLabel(e.status)}</span>
                  <span className="col-start-2 md:col-start-auto md:text-right">
                    {e.ticketUrl && e.status !== "sold-out" ? (
                      <a {...linkAttrs(e.ticketUrl)} className="skin-btn min-h-11">
                        {ctaLabel ?? t("tickets")} →
                      </a>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
