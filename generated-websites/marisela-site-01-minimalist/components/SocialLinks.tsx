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
        <ul className="grid border-b border-border sm:grid-cols-2 md:ml-[25%] lg:grid-cols-3">
          {list.map((l) => (
            <li key={l.href} className="border-t border-border">
              <a {...linkAttrs(l.href)} className="group flex min-h-16 items-center justify-between gap-4 py-4 pr-4">
                <span className="flex items-center gap-3">
                  <BrandIcon platform={l.platform} className="h-4 w-4 text-muted-foreground transition group-hover:text-accent" />
                  <span className="font-light">{l.label}</span>
                </span>
                <span className="text-xs text-muted-foreground">{l.handle ?? "↗"}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
