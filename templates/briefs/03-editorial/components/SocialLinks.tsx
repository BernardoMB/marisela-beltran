import type { SocialLinksProps } from "@/lib/types";
import { BrandIcon } from "@/components/BrandIcons";
import { SectionHeading } from "@/components/SectionHeading";
import { linkAttrs, sortSocialLinks } from "@/lib/utils";

export default function SocialLinks({ anchorId, title, eyebrow, intro, links }: SocialLinksProps) {
  const list = sortSocialLinks(links);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} />
        <ul className="flex flex-wrap items-center gap-x-2 gap-y-4 font-display text-2xl italic md:text-3xl">
          {list.map((l, i) => (
            <li key={l.href} className="flex items-center gap-2">
              {i > 0 ? (
                <span className="text-accent" aria-hidden>
                  ·
                </span>
              ) : null}
              <a {...linkAttrs(l.href)} className="inline-flex min-h-11 items-center gap-2 underline decoration-border decoration-1 underline-offset-8 hover:text-accent hover:decoration-accent">
                <BrandIcon platform={l.platform} className="h-5 w-5 not-italic" />
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
