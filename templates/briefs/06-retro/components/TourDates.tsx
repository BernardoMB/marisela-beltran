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
          <Reveal className="retro-bulbs mx-auto max-w-3xl rounded-[28px] border-2 border-border bg-primary p-5 shadow-lg">
            <div className="rounded-[18px] border-2 border-border bg-foreground px-6 py-10 text-center text-background">
              <p className="retro-mono text-xs text-secondary">✦ ✦ ✦</p>
              <p className="mt-3 font-display text-4xl md:text-5xl" style={{ textShadow: "3px 3px 0 var(--primary)" }}>
                {emptyTitle}
              </p>
              <p className="mx-auto mt-4 max-w-lg text-background/85">{emptyMessage}</p>
              {ticketsUrl ? (
                <a {...linkAttrs(ticketsUrl)} className="mt-6 inline-flex h-12 items-center rounded-full border-2 border-background bg-secondary px-7 font-bold text-secondary-foreground">
                  {ctaLabel ?? t("tickets")}
                </a>
              ) : null}
            </div>
          </Reveal>
        ) : (
          <ol className="grid gap-6 md:grid-cols-2">
            {events.map((e, i) => {
              const d = formatEventDate(e.date, LOCALE);
              return (
                <Reveal key={e.id} delay={(i % 2) * 0.06}>
                  <li className="retro-ticket flex overflow-hidden shadow-md">
                    <div className="flex-1 p-5">
                      <p className="retro-mono text-[10px] text-muted-foreground">ADMIT ONE · Nº {String(i + 1).padStart(4, "0")}</p>
                      <p className="mt-2 font-display text-3xl text-primary">
                        {d.day} {d.monthShort}
                      </p>
                      <p className="mt-1 text-lg font-bold">{e.venue}</p>
                      <p className="text-sm text-muted-foreground">{[e.city, e.region, e.country].filter(Boolean).join(", ")}</p>
                    </div>
                    <div className="flex w-28 flex-col items-center justify-center gap-2 border-l-2 border-dashed border-border bg-secondary/40 p-3 text-center">
                      <span className="retro-mono text-[10px]">{eventStatusLabel(e.status)}</span>
                      {e.ticketUrl && e.status !== "sold-out" ? (
                        <a {...linkAttrs(e.ticketUrl)} className="skin-btn inline-flex h-11 items-center px-3 text-xs">
                          {ctaLabel ?? t("tickets")}
                        </a>
                      ) : null}
                      <span className="retro-mono text-[10px]">{d.year}</span>
                    </div>
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
