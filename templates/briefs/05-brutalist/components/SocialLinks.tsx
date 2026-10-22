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
        <ul className="border-t-[3px] border-foreground">
          {list.map((l, i) => (
            <li key={l.href} className="border-b-[3px] border-foreground">
              <a {...linkAttrs(l.href)} className="brut-invert flex min-h-16 items-center gap-4 px-2 text-lg font-bold uppercase md:text-2xl">
                <span className="w-10 text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <BrandIcon platform={l.platform} className="h-5 w-5" />
                <span className="flex-1">→ {l.label}</span>
                <span className="hidden text-sm normal-case md:inline">{l.handle ?? l.href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
