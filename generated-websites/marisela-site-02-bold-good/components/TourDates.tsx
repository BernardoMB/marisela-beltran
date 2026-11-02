import { Ticket } from "lucide-react";
import type { TourDatesProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { LOCALE, eventStatusLabel, t } from "@/lib/i18n";
import { formatEventDate, linkAttrs } from "@/lib/utils";

export default function TourDates({ anchorId, title, eyebrow, intro, events, tourName, ticketsUrl, emptyTitle, emptyMessage, ctaLabel }: TourDatesProps) {
  return (
    <section id={anchorId} className="skin-section">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        {eyebrow ? <p className="skin-eyebrow">{eyebrow}</p> : null}
        <h2 className="skin-title">{title}</h2>
        {intro || tourName ? <p className="skin-lead mt-4 max-w-xl">{intro ?? tourName}</p> : null}
        {events.length === 0 ? (
          <Reveal className="relative mt-12 overflow-hidden rounded-[var(--radius-lg)] bg-linear-to-br from-gradient-from via-gradient-via to-gradient-to p-8 text-primary-foreground shadow-lg md:p-16">
            <p className="font-display text-[clamp(3rem,10vw,8rem)] uppercase leading-[0.85] text-background">{emptyTitle}</p>
            <p className="mt-6 max-w-xl text-lg font-semibold text-background/90">{emptyMessage}</p>
            {ticketsUrl ? (
              <a {...linkAttrs(ticketsUrl)} className="mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-background px-8 text-sm font-extrabold uppercase tracking-wider text-foreground">
                <Ticket className="h-5 w-5" aria-hidden />
                {ctaLabel ?? t("tickets")}
              </a>
            ) : null}
          </Reveal>
        ) : (
          <ol className="mt-12 flex flex-col gap-5">
            {events.map((e, i) => {
              const d = formatEventDate(e.date, LOCALE);
              return (
                <Reveal key={e.id} delay={i * 0.05}>
                  <li className="bold-ticket grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 p-6 md:grid-cols-[9rem_1fr_auto] md:px-10">
                    <span className="border-r-2 border-dashed border-foreground/20 pr-6 text-center">
                      <span className="bold-gradient-text block font-display text-6xl leading-none">{d.day}</span>
                      <span className="text-xs font-extrabold uppercase tracking-[0.2em]">
                        {d.monthShort} {d.year}
                      </span>
                    </span>
                    <span>
                      <span className="block font-display text-2xl uppercase md:text-3xl">{e.venue}</span>
                      <span className="text-sm text-muted-foreground">{[e.city, e.region, e.country].filter(Boolean).join(", ")}</span>
                    </span>
                    <span className="col-span-2 flex items-center gap-3 md:col-span-1">
                      <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold uppercase text-accent-foreground">{eventStatusLabel(e.status)}</span>
                      {e.ticketUrl && e.status !== "sold-out" ? (
                        <a {...linkAttrs(e.ticketUrl)} className="skin-btn inline-flex h-12 items-center gap-2 px-6 text-xs">
                          <Ticket className="h-4 w-4" aria-hidden />
                          {ctaLabel ?? t("tickets")}
                        </a>
                      ) : null}
                    </span>
                  </li>
                </Reveal>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
