import type { VideoGalleryProps } from "@/lib/types";
import { LiteYouTube } from "@/components/LiteYouTube";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { t } from "@/lib/i18n";
import { cn, linkAttrs, take } from "@/lib/utils";

/** Shared, skinnable video gallery: one featured video + a grid (briefs may override this file). */
export default function VideoGallery({ anchorId, title, eyebrow, intro, videos, limit, channelUrl }: VideoGalleryProps) {
  const list = take(videos, limit ?? 6);
  return (
    <section id={anchorId} className="c-videos skin-section">
      <div className="skin-container">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} />
        {list.length === 0 ? (
          <p className="skin-lead">{t("emptyVideos")}</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {list.map((v, i) => (
              <Reveal key={v.id} delay={i * 0.05} className={cn("video-card flex flex-col gap-3", i === 0 && "md:col-span-2 lg:row-span-2")}>
                <LiteYouTube youtubeId={v.youtubeId} title={v.title} className="skin-media" />
                <p className={cn("video-title text-sm leading-snug", i === 0 && "md:text-base")}>{v.title}</p>
              </Reveal>
            ))}
          </div>
        )}
        {channelUrl ? (
          <p className="mt-8">
            <a {...linkAttrs(channelUrl)} className="skin-link">
              {t("watchOnYoutube")}
            </a>
          </p>
        ) : null}
      </div>
    </section>
  );
}
