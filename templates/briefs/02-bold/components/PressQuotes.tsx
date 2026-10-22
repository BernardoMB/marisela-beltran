import type { PressQuotesProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { t } from "@/lib/i18n";
import { cn, linkAttrs, take } from "@/lib/utils";

const TONES = ["bg-primary text-primary-foreground", "bg-secondary text-secondary-foreground", "bg-accent text-accent-foreground"];
const TILTS = ["md:rotate-[-2deg]", "md:rotate-[1.5deg] md:mt-16", "md:rotate-[-1deg] md:-mt-6"];

export default function PressQuotes({ anchorId, title, eyebrow, quotes, limit }: PressQuotesProps) {
  const list = take(quotes, limit ?? 6);
  return (
    <section id={anchorId} className="skin-section">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        {eyebrow ? <p className="skin-eyebrow">{eyebrow}</p> : null}
        <h2 className="skin-title">{title}</h2>
        {list.length === 0 ? (
          <p className="skin-lead mt-8">{t("emptyQuotes")}</p>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {list.map((q, i) => (
              <Reveal key={q.id} delay={(i % 3) * 0.08}>
                <figure className={cn("flex h-full flex-col justify-between gap-6 rounded-[var(--radius)] p-7 shadow-md transition-transform duration-300 hover:rotate-0", TONES[i % 3], TILTS[i % 3])}>
                  <blockquote className="text-lg font-bold leading-snug md:text-xl">
                    <span className="block font-display text-6xl leading-[0.5]" aria-hidden>
                      “
                    </span>
                    {q.quote}
                  </blockquote>
                  <figcaption className="text-xs font-extrabold uppercase tracking-[0.2em] opacity-80">
                    {q.url ? (
                      <a {...linkAttrs(q.url)} className="underline-offset-4 hover:underline">
                        — {q.author ? `${q.author}, ` : ""}
                        {q.outlet}
                      </a>
                    ) : (
                      <>
                        — {q.author ? `${q.author}, ` : ""}
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
