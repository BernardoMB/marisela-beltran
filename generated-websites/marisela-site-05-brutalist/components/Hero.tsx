"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { HeroProps } from "@/lib/types";
import { SmartImage } from "@/components/SmartImage";
import { t } from "@/lib/i18n";
import { linkAttrs } from "@/lib/utils";

function useTyped(text: string, enabled: boolean): string {
  const [n, setN] = useState(enabled ? 0 : text.length);
  useEffect(() => {
    if (!enabled) return;
    setN(0);
    const id = window.setInterval(() => setN((v) => (v >= text.length ? (window.clearInterval(id), v) : v + 1)), 70);
    return () => window.clearInterval(id);
  }, [text, enabled]);
  return text.slice(0, n);
}

export default function Hero({ anchorId, variant, title, eyebrow, subtitle, tagline, primaryCta, secondaryCta, image, stats }: HeroProps) {
  const reduce = useReducedMotion();
  const typed = useTyped(title.toUpperCase(), !reduce);
  const rows: Array<[string, string]> = [
    ...(tagline ? ([["TAGLINE", tagline]] as Array<[string, string]>) : []),
    ...(stats ?? []).slice(0, 4).map((s) => [s.label.toUpperCase(), s.value] as [string, string]),
  ];

  if (variant === "poster" && image) {
    return (
      <section id={anchorId} className="skin-container py-6">
        <div className="relative border-[3px] border-foreground">
          <div className="relative aspect-[16/9] w-full">
            <SmartImage image={image} fill priority sizes="100vw" />
          </div>
          <div className="relative -mt-16 ml-4 mr-4 max-w-3xl border-[3px] border-foreground bg-background p-5 shadow-md md:absolute md:bottom-6 md:left-6 md:m-0">
            {eyebrow ? <p className="mb-2 inline-block bg-foreground px-2 text-xs text-background">{eyebrow}</p> : null}
            <h1 className="brut-cursor font-display text-[clamp(3rem,10vw,8rem)] font-bold leading-[0.9]" aria-label={title}>
              {typed}
            </h1>
            {subtitle ? <p className="mt-3 max-w-2xl text-sm">{subtitle}</p> : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id={anchorId} className="skin-container grid gap-6 py-8 lg:grid-cols-[1.4fr_1fr] lg:py-12">
      <div className="flex flex-col">
        {eyebrow ? <p className="mb-4 w-fit bg-foreground px-2 py-0.5 text-xs text-background">{eyebrow}</p> : null}
        <h1 className="brut-cursor break-words font-display text-[clamp(3.5rem,13vw,11rem)] font-bold leading-[0.85] tracking-[-0.04em]" aria-label={title}>
          {typed}
        </h1>
        {subtitle ? <p className="mt-6 max-w-2xl border-l-[6px] border-accent pl-4 text-sm leading-relaxed">{subtitle}</p> : null}
        {rows.length ? (
          <table className="brut-table mt-8 text-sm">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <th scope="row" className="w-1/3">
                    {k}
                  </th>
                  <td className="font-semibold">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          {primaryCta ? (
            <a {...linkAttrs(primaryCta.href)} className="skin-btn inline-flex min-h-12 items-center px-6">
              {primaryCta.label}
            </a>
          ) : null}
          {secondaryCta ? (
            <a {...linkAttrs(secondaryCta.href)} className="skin-btn-ghost inline-flex min-h-12 items-center px-6">
              {secondaryCta.label}
            </a>
          ) : null}
        </div>
      </div>
      {image ? (
        <figure className="self-start">
          <div className="skin-media relative aspect-[4/5] w-full shadow-lg">
            <SmartImage image={image} fill priority sizes="(min-width: 1024px) 40vw, 100vw" />
          </div>
          <figcaption className="mt-3 border-[3px] border-foreground px-3 py-2 text-xs uppercase">
            IMG_001.JPG {image.credit ? `— ${t("photoCredit")}: ${image.credit}` : ""}
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}
