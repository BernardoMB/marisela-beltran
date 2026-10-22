import type { SocialLinksProps } from "@/lib/types";
import { BrandIcon } from "@/components/BrandIcons";
import { SectionHeading } from "@/components/SectionHeading";
import { cn, linkAttrs, sortSocialLinks } from "@/lib/utils";

const PIN = ["bg-primary text-primary-foreground", "bg-secondary text-secondary-foreground", "bg-accent text-accent-foreground"];

export default function SocialLinks({ anchorId, title, eyebrow, intro, links }: SocialLinksProps) {
  const list = sortSocialLinks(links);
  return (
    <section id={anchorId} className="skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} align="center" />
        <ul className="flex flex-wrap justify-center gap-8">
          {list.map((l, i) => (
            <li key={l.href}>
              <a {...linkAttrs(l.href)} className="group flex flex-col items-center gap-3">
                <span className={cn("flex h-24 w-24 items-center justify-center rounded-full border-2 border-border shadow-md transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[-8deg]", PIN[i % 3])}>
                  <BrandIcon platform={l.platform} className="h-9 w-9" />
                </span>
                <span className="retro-mono text-xs">{l.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
