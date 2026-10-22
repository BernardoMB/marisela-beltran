import type { PressQuotesProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { t } from "@/lib/i18n";
import { cn, linkAttrs, take } from "@/lib/utils";

export default function PressQuotes({ anchorId, title, eyebrow, quotes, limit }: PressQuotesProps) {
  const list = take(quotes, limit ?? 4);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} />
        {list.length === 0 ? (
          <p className="skin-lead">{t("emptyQuotes")}</p>
        ) : (
          <div className="flex flex-col gap-16">
            {list.map((q, i) => (
              <Reveal key={q.id} className={cn("max-w-4xl", i % 2 === 1 ? "md:ml-auto md:text-right" : "")}>
                <figure>
                  <span className="block font-display text-8xl leading-[0.6] text-accent" aria-hidden>
                    “
                  </span>
                  <blockquote className="font-display text-[clamp(1.6rem,3.2vw,2.6rem)] italic leading-snug">{q.quote}</blockquote>
                  <figcaption className="mt-5 ed-smallcaps text-lg">
                    —{" "}
                    {q.url ? (
                      <a {...linkAttrs(q.url)} className="hover:text-accent">
                        {q.author ? `${q.author}, ` : ""}
                        {q.outlet}
                      </a>
                    ) : (
                      `${q.author ? `${q.author}, ` : ""}${q.outlet}`
                    )}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
