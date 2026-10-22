import type { SocialLinksProps } from "@/lib/types";
import { BrandIcon } from "@/components/BrandIcons";
import { Reveal } from "@/components/Reveal";
import { cn, linkAttrs, sortSocialLinks } from "@/lib/utils";

const TONES = ["hover:bg-primary hover:text-primary-foreground", "hover:bg-secondary hover:text-secondary-foreground", "hover:bg-accent hover:text-accent-foreground"];

export default function SocialLinks({ anchorId, title, eyebrow, intro, links }: SocialLinksProps) {
  const list = sortSocialLinks(links);
  return (
    <section id={anchorId} className="skin-section">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        {eyebrow ? <p className="skin-eyebrow">{eyebrow}</p> : null}
        <h2 className="skin-title bold-gradient-text">{title}</h2>
        {intro ? <p className="skin-lead mt-4 max-w-xl">{intro}</p> : null}
        <ul className="mt-12 flex flex-wrap gap-4">
          {list.map((l, i) => (
            <li key={l.href}>
              <Reveal delay={i * 0.04}>
                <a {...linkAttrs(l.href)} className={cn("group inline-flex h-16 items-center gap-3 rounded-full border-2 border-foreground/20 px-7 text-lg font-extrabold uppercase transition duration-300 hover:-rotate-2 hover:scale-105 hover:border-transparent", TONES[i % 3])}>
                  <BrandIcon platform={l.platform} className="h-6 w-6" />
                  {l.label}
                </a>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
