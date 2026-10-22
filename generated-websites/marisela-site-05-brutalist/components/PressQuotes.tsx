import type { PressQuotesProps } from "@/lib/types";
import { SectionHeading } from "@/components/SectionHeading";
import { t } from "@/lib/i18n";
import { linkAttrs, take } from "@/lib/utils";

export default function PressQuotes({ anchorId, title, eyebrow, quotes, limit }: PressQuotesProps) {
  const list = take(quotes, limit ?? 6);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} />
        {list.length === 0 ? (
          <p className="border-[3px] border-foreground p-6 font-bold">NO DATA — {t("emptyQuotes")}</p>
        ) : (
          <div className="grid gap-0 border-l-[3px] border-t-[3px] border-foreground md:grid-cols-2">
            {list.map((q) => (
              <figure key={q.id} className="border-b-[3px] border-r-[3px] border-foreground p-5 md:p-7">
                <blockquote className="border-l-[6px] border-accent pl-4 text-base leading-7">
                  <span className="mr-1 font-bold text-muted-foreground" aria-hidden>
                    &gt;
                  </span>
                  {q.quote}
                </blockquote>
                <figcaption className="mt-4 text-xs font-bold uppercase">
                  —{" "}
                  {q.url ? (
                    <a {...linkAttrs(q.url)} className="skin-link">
                      {q.author ? `${q.author}, ` : ""}
                      {q.outlet}
                    </a>
                  ) : (
                    `${q.author ? `${q.author}, ` : ""}${q.outlet}`
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
