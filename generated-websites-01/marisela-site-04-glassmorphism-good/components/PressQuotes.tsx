import { Quote as QuoteIcon } from "lucide-react";
import type { PressQuotesProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
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
          <p className="skin-lead">{t("emptyQuotes")}</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {list.map((q, i) => (
              <Reveal key={q.id} delay={(i % 3) * 0.08}>
                <figure className="glass flex h-full flex-col gap-6 p-7">
                  <QuoteIcon className="h-7 w-7 text-primary" aria-hidden />
                  <blockquote className="flex-1 text-lg leading-relaxed text-foreground/90">{q.quote}</blockquote>
                  <figcaption className="flex items-center gap-3 border-t border-foreground/10 pt-4 text-sm">
                    <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" aria-hidden />
                    {q.url ? (
                      <a {...linkAttrs(q.url)} className="text-muted-foreground hover:text-foreground">
                        {q.author ? `${q.author} · ` : ""}
                        {q.outlet}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">
                        {q.author ? `${q.author} · ` : ""}
                        {q.outlet}
                      </span>
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
