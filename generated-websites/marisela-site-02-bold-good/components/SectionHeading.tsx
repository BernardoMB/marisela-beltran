import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Eyebrow + title + optional intro, styled by the brief's skin classes (styles.css). */
export function SectionHeading({ eyebrow, title, intro, className, align = "left", children }: { eyebrow?: string; title?: string; intro?: string; className?: string; align?: "left" | "center"; children?: ReactNode }) {
  if (!eyebrow && !title && !intro) return null;
  return (
    <header className={cn("skin-heading mb-10 md:mb-14", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="skin-eyebrow">{eyebrow}</p> : null}
      {title ? <h2 className="skin-title">{title}</h2> : null}
      {intro ? <p className="skin-lead mt-4 max-w-2xl">{intro}</p> : null}
      {children}
    </header>
  );
}
