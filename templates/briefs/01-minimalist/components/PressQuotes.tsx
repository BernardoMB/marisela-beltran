import type { PressQuotesProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { t } from "@/lib/i18n";
import { linkAttrs, take } from "@/lib/utils";

export default function PressQuotes({ anchorId, title, eyebrow, quotes, limit }: PressQuotesProps) {
  const list = take(quotes, limit ?? 4);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} />
        {list.length === 0 ? (
          <p className="skin-lead">{t("emptyQuotes")}</p>
        ) : (
          <div className="grid gap-x-12 md:ml-[25%] md:grid-cols-2">
            {list.map((q, i) => (
              <Reveal key={q.id} delay={(i % 2) * 0.08} className="border-t border-border py-10">
                <figure>
                  <blockquote className="font-display text-xl font-light leading-relaxed md:text-2xl">
                    <span className="mr-1 inline-block h-1.5 w-1.5 -translate-y-1 rounded-full bg-accent align-middle" aria-hidden />
                    {q.quote}
                  </blockquote>
                  <figcaption className="mt-6 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                    {q.url ? (
                      <a {...linkAttrs(q.url)} className="hover:text-foreground">
                        {q.author ? `${q.author} — ` : ""}
                        {q.outlet}
                      </a>
                    ) : (
                      <>
                        {q.author ? `${q.author} — ` : ""}
                        {q.outlet}
                      </>
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
