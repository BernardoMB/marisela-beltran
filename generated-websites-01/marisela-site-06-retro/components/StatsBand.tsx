import type { StatsBandProps } from "@/lib/types";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";

/** Shared, skinnable stats band (briefs may override this file). */
export default function StatsBand({ anchorId, title, eyebrow, items, note }: StatsBandProps) {
  if (!items?.length) return null;
  return (
    <section id={anchorId} className="c-stats skin-section skin-band">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} />
        <dl className="grid grid-cols-2 gap-px md:grid-cols-4">
          {items.slice(0, 8).map((s, i) => (
            <Reveal key={s.id} delay={i * 0.06} className="stat-cell skin-card flex flex-col gap-2 p-6 md:p-8">
              <dt className="stat-label order-2 text-sm skin-muted">{s.label}</dt>
              <dd className="stat-value order-1 font-display text-4xl leading-none md:text-6xl">{s.value}</dd>
              {s.detail ? <dd className="order-3 text-xs skin-muted">{s.detail}</dd> : null}
            </Reveal>
          ))}
        </dl>
        {note ? <p className="mt-6 text-xs skin-muted">{note}</p> : null}
      </div>
    </section>
  );
}
