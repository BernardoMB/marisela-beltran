"use client";

import { Play } from "lucide-react";
import { useState, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { cn, youtubeEmbedUrl, youtubeThumbnail } from "@/lib/utils";

export interface LiteYouTubeProps {
  youtubeId: string;
  title: string;
  className?: string;
  /** Classes for the thumbnail <img>. */
  imageClassName?: string;
  /** Custom play affordance rendered over the thumbnail (defaults to a round play button). */
  playOverlay?: ReactNode;
}

/**
 * Click-to-load YouTube player: shows the thumbnail until the visitor presses play, then swaps in a
 * privacy-enhanced (youtube-nocookie) iframe. Keeps pages fast and avoids third-party cookies on load.
 * The parent controls the size; this component fills it with a 16:9 box.
 */
export function LiteYouTube({ youtubeId, title, className, imageClassName, playOverlay }: LiteYouTubeProps) {
  const [active, setActive] = useState(false);
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden bg-black", className)}>
      {active ? (
        <iframe
          src={youtubeEmbedUrl(youtubeId)}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="group absolute inset-0 h-full w-full cursor-pointer"
          aria-label={`${t("watch")}: ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={youtubeThumbnail(youtubeId)}
            alt=""
            loading="lazy"
            className={cn("absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]", imageClassName)}
          />
          {playOverlay ?? (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition group-hover:scale-110">
                <Play className="ml-1 h-7 w-7" aria-hidden />
              </span>
            </span>
          )}
        </button>
      )}
    </div>
  );
}
