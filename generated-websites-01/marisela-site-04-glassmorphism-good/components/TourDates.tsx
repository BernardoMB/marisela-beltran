import { CalendarDays, MapPin, Ticket } from "lucide-react";
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
          <Reveal className="glass relative mx-auto max-w-3xl overflow-hidden p-10 text-center md:p-14">
            <span className="absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-40 blur-3xl" aria-hidden />
            <CalendarDays className="mx-auto h-10 w-10 text-primary" aria-hidden />
            <p className="mt-5 font-display text-3xl font-light md:text-4xl">{emptyTitle}</p>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">{emptyMessage}</p>
            {ticketsUrl ? (
              <a {...linkAttrs(ticketsUrl)} className="skin-btn mt-8 inline-flex h-12 items-center gap-2 px-7 font-semibold">
                <Ticket className="h-4 w-4" aria-hidden />
                {ctaLabel ?? t("tickets")}
              </a>
            ) : null}
          </Reveal>
        ) : (
          <ol className="flex flex-col gap-3">
            {events.map((e, i) => {
              const d = formatEventDate(e.date, LOCALE);
              const live = e.status === "on-sale";
              return (
                <Reveal key={e.id} delay={i * 0.05}>
                  <li className="glass grid grid-cols-[4.5rem_1fr] items-center gap-4 p-4 md:grid-cols-[6rem_1fr_auto_auto] md:p-5">
                    <span className="flex flex-col items-center justify-center rounded-2xl bg-foreground/10 py-2">
                      <span className="font-display text-3xl font-semibold leading-none">{d.day}</span>
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{d.monthShort}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-medium">{e.venue}</span>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        {[e.city, e.region, e.country].filter(Boolean).join(", ")}
                      </span>
                    </span>
                    <span className={`col-start-2 w-fit rounded-full px-3 py-1 text-xs md:col-start-auto ${live ? "bg-primary/20 text-primary shadow-[0_0_18px_var(--glow)]" : "bg-foreground/10 text-muted-foreground"}`}>{eventStatusLabel(e.status)}</span>
                    {e.ticketUrl && e.status !== "sold-out" ? (
                      <a {...linkAttrs(e.ticketUrl)} className="skin-btn col-start-2 inline-flex h-11 w-fit items-center gap-2 px-5 text-sm font-semibold md:col-start-auto">
                        <Ticket className="h-4 w-4" aria-hidden />
                        {ctaLabel ?? t("tickets")}
                      </a>
                    ) : (
                      <span />
                    )}
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
