"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { PhotoGalleryProps } from "@/lib/types";
import { SmartImage } from "@/components/SmartImage";
import { SectionHeading } from "@/components/SectionHeading";
import { t } from "@/lib/i18n";
import { take } from "@/lib/utils";

/** Shared, skinnable photo gallery with a keyboard-accessible lightbox (briefs may override this file). */
export default function PhotoGallery({ anchorId, title, eyebrow, images, limit }: PhotoGalleryProps) {
  const list = take(images, limit ?? 12);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((o) => (o === null ? o : (o + 1) % list.length));
      if (e.key === "ArrowLeft") setOpen((o) => (o === null ? o : (o - 1 + list.length) % list.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, list.length]);

  return (
    <section id={anchorId} className="c-gallery skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} />
        {list.length === 0 ? (
          <p className="skin-lead">{t("emptyPhotos")}</p>
        ) : (
          <ul className={list.length === 1 ? "grid" : "columns-1 gap-4 sm:columns-2 lg:columns-3"}>
            {list.map((img, i) => (
              <li key={img.src} className="mb-4 break-inside-avoid">
                <figure className="photo-card">
                  <button type="button" onClick={() => setOpen(i)} className="skin-media block w-full overflow-hidden" aria-label={img.alt || t("moreInfo")}>
                    <SmartImage image={img} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="h-auto w-full transition duration-500 hover:scale-[1.03]" />
                  </button>
                  {img.credit && !img.placeholder ? (
                    <figcaption className="mt-2 text-xs skin-muted">
                      {t("photoCredit")}: {img.credit}
                      {img.license ? ` · ${img.license}` : ""}
                    </figcaption>
                  ) : null}
                </figure>
              </li>
            ))}
          </ul>
        )}
      </div>
      <AnimatePresence>
        {open !== null && list[open] ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={list[open].alt}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
          >
            <button type="button" onClick={() => setOpen(null)} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white" aria-label={t("close")}>
              <X className="h-5 w-5" aria-hidden />
            </button>
            <div className="relative max-h-[85vh] max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <SmartImage image={list[open]} sizes="90vw" className="h-auto max-h-[85vh] w-auto object-contain" />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
