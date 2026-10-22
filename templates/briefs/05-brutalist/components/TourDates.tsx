import type { TourDatesProps } from "@/lib/types";
import { SectionHeading } from "@/components/SectionHeading";
import { LOCALE, eventStatusLabel, t } from "@/lib/i18n";
import { formatEventDate, linkAttrs } from "@/lib/utils";

export default function TourDates({ anchorId, title, eyebrow, intro, events, tourName, ticketsUrl, emptyTitle, emptyMessage, ctaLabel }: TourDatesProps) {
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro ?? tourName} />
        {events.length === 0 ? (
          <div className="skin-card grid md:grid-cols-[auto_1fr]">
            <p className="flex items-center justify-center border-b-[3px] border-foreground bg-accent px-8 py-6 font-display text-4xl font-bold text-accent-foreground md:border-b-0 md:border-r-[3px]">NO DATA</p>
            <div className="p-6">
              <p className="text-xl font-bold uppercase">{emptyTitle}</p>
              <p className="mt-2 text-sm">{emptyMessage}</p>
              {ticketsUrl ? (
                <a {...linkAttrs(ticketsUrl)} className="skin-btn mt-5 inline-flex min-h-12 items-center px-6">
                  {ctaLabel ?? `[${t("tickets").toUpperCase()}]`}
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="brut-table min-w-[36rem] text-sm">
              <thead>
                <tr>
                  <th scope="col" className="w-36">
                    {t("date").toUpperCase()}
                  </th>
                  <th scope="col">{t("venue").toUpperCase()}</th>
                  <th scope="col">{t("city").toUpperCase()}</th>
                  <th scope="col" className="w-32">
                    STATUS
                  </th>
                  <th scope="col" className="w-36" />
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const d = formatEventDate(e.date, LOCALE);
                  return (
                    <tr key={e.id} className="brut-invert">
                      <td className="font-bold tabular-nums">{d.numeric}</td>
                      <td className="font-bold uppercase">{e.venue}</td>
                      <td className="uppercase">{[e.city, e.region, e.country].filter(Boolean).join(", ")}</td>
                      <td className="uppercase">{eventStatusLabel(e.status)}</td>
                      <td>
                        {e.ticketUrl && e.status !== "sold-out" ? (
                          <a {...linkAttrs(e.ticketUrl)} className="inline-flex min-h-11 items-center bg-accent px-3 font-bold text-accent-foreground">
                            {ctaLabel ?? `[${t("tickets").toUpperCase()}]`}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
