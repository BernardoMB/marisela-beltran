import type { PressQuotesProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { t } from "@/lib/i18n";
import { cn, linkAttrs, take } from "@/lib/utils";

const TILT = ["md:-rotate-2", "md:rotate-1", "md:rotate-2", "md:-rotate-1"];

export default function PressQuotes({ anchorId, title, eyebrow, quotes, limit }: PressQuotesProps) {
  const list = take(quotes, limit ?? 6);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} />
        {list.length === 0 ? (
          <p className="skin-lead">{t("emptyQuotes")}</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {list.map((q, i) => (
              <Reveal key={q.id} delay={(i % 3) * 0.07}>
                {/* The shadow lives on a wrapper: clip-path on the clipping itself would cut it off. */}
                <div className={cn("drop-shadow-[4px_4px_0_var(--border)] transition hover:rotate-0", TILT[i % 4])}>
                  <figure className="retro-clipping px-6 pb-8 pt-9">
                    <p className="retro-mono mb-3 border-b-2 border-border pb-2 text-[10px]">{q.outlet}</p>
                    <blockquote className="text-lg italic leading-relaxed">“{q.quote}”</blockquote>
                    {q.url ? (
                      <figcaption className="retro-mono mt-4 text-[10px]">
                        <a {...linkAttrs(q.url)} className="underline decoration-dashed underline-offset-4 hover:text-primary">
                          {q.author ?? t("sources")}
                        </a>
                      </figcaption>
                    ) : null}
                  </figure>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
