import type { SocialLinksProps } from "@/lib/types";
import { BrandIcon } from "@/components/BrandIcons";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { linkAttrs, sortSocialLinks } from "@/lib/utils";

export default function SocialLinks({ anchorId, title, eyebrow, intro, links }: SocialLinksProps) {
  const list = sortSocialLinks(links);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} align="center" />
        <ul className="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {list.map((l, i) => (
            <li key={l.href}>
              <Reveal delay={i * 0.05}>
                <a {...linkAttrs(l.href)} className="glass group flex aspect-square flex-col items-center justify-center gap-3 p-4 text-center transition hover:-translate-y-1 hover:shadow-[0_20px_50px_-18px_var(--glow)]">
                  <BrandIcon platform={l.platform} className="h-8 w-8 transition group-hover:scale-110 group-hover:text-primary" />
                  <span className="text-sm font-medium">{l.label}</span>
                  {l.handle ? <span className="text-xs text-muted-foreground">{l.handle}</span> : null}
                </a>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
