"use client";

import { useEffect, useRef, useState } from "react";
import { preconnect, preload } from "react-dom";
import { cn, youtubeThumbnail } from "@/lib/utils";

/* Minimal typings for the parts of the YouTube IFrame Player API used here. */
interface YTPlayer {
  mute(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  /** Undocumented but long-standing; used to drop the captions YouTube auto-enables for muted autoplay. */
  unloadModule?(name: string): void;
  destroy(): void;
}
interface YTPlayerEvent {
  target: YTPlayer;
  data: number;
}
interface YTNamespace {
  Player: new (
    el: HTMLIFrameElement,
    opts: { events?: { onReady?: (e: YTPlayerEvent) => void; onStateChange?: (e: YTPlayerEvent) => void } },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number };
}
type YTWindow = Window & { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };

const API_SRC = "https://www.youtube.com/iframe_api";
const EMBED_HOST = "https://www.youtube-nocookie.com";
/**
 * Extra video kept outside the hero at the top and at the bottom, so YouTube's top bar (title) and
 * bottom bar ("More videos", logo) are always cropped off. Scales a little with the player, because
 * YouTube enlarges its chrome on big players.
 */
const CHROME_CROP = "max(64px, 6cqh)";
/** Restart this close to the end so the player never reaches ENDED (which shows the end screen). */
const LOOP_LEAD_SECONDS = 0.6;

let apiPromise: Promise<YTNamespace> | null = null;

/** Loads the IFrame Player API once per page, chaining any existing ready callback. */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const w = window as YTWindow;
    if (w.YT?.Player) return resolve(w.YT);
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(w.YT as YTNamespace);
    };
    const script = document.createElement("script");
    script.src = API_SRC;
    script.async = true;
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** Autoplaying, muted, chrome-less embed URL. `enablejsapi` lets the API attach to the already-playing iframe. */
function embedSrc(id: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    playsinline: "1",
    loop: "1",
    playlist: id,
    rel: "0",
    fs: "0",
    disablekb: "1",
    iv_load_policy: "3",
    cc_load_policy: "0",
    modestbranding: "1",
    enablejsapi: "1",
  });
  return `${EMBED_HOST}/embed/${id}?${params}`;
}

export interface BackgroundVideoProps {
  youtubeId: string;
  /** Width / height of the source video (16:9 unless the upload differs). */
  aspectRatio?: number;
  className?: string;
}

/**
 * Decorative, muted, looping YouTube video that covers its positioned parent edge to edge —
 * the iframe equivalent of `object-fit: cover; object-position: center`.
 *
 * The player box is sized in container-query units of the layer itself, so it tracks the hero box
 * (not `vw`, which includes the scrollbar and would cause horizontal overflow):
 *   width  = max(100% of width,                   (height + 2 × crop) × ratio)
 *   height = max(height + 2 × crop,  100% of width ÷ ratio)
 * and is centered with translate(-50%, -50%), so any excess is cropped equally from both sides —
 * always including CHROME_CROP at the top and bottom, where YouTube draws its bars.
 *
 * The iframe is server-rendered so the browser starts loading and autoplaying it with the page,
 * before hydration. The IFrame API attaches afterwards only to loop seamlessly and drop captions.
 * The video's thumbnail (sized like the player, so the two line up) shows until the first frame
 * plays — for good if autoplay is blocked — then the video opens over it with a soft iris and
 * crossfade (.bg-video-reveal in app/globals.css).
 */
export function BackgroundVideo({ youtubeId, aspectRatio = 16 / 9, className }: BackgroundVideoProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);

  preconnect(EMBED_HOST);
  preconnect("https://www.youtube.com");
  preconnect("https://i.ytimg.com");
  preload(API_SRC, { as: "script" });

  useEffect(() => {
    let player: YTPlayer | undefined;
    let cancelled = false;
    let loopTimer: number | undefined;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !iframeRef.current) return;
      const onPlaying = (p: YTPlayer) => {
        setPlaying(true);
        p.unloadModule?.("captions");
        p.unloadModule?.("cc");
        loopTimer ??= window.setInterval(() => {
          const duration = p.getDuration();
          if (duration > 0 && p.getCurrentTime() >= duration - LOOP_LEAD_SECONDS) p.seekTo(0, true);
        }, 250);
      };
      player = new YT.Player(iframeRef.current, {
        events: {
          onReady: (e) => {
            e.target.mute();
            // Usually already playing by now (the iframe autoplays on its own); otherwise nudge it.
            if (e.target.getPlayerState() === YT.PlayerState.PLAYING) onPlaying(e.target);
            else e.target.playVideo();
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) onPlaying(e.target);
            // Fallback if the player still reaches the end (e.g. throttled timers in a background tab).
            if (e.data === YT.PlayerState.ENDED) {
              e.target.seekTo(0, true);
              e.target.playVideo();
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      window.clearInterval(loopTimer);
      player?.destroy();
    };
  }, [youtubeId]);

  const coverBox = {
    width: `max(100cqw, calc((100cqh + 2 * ${CHROME_CROP}) * ${aspectRatio}))`,
    height: `max(calc(100cqh + 2 * ${CHROME_CROP}), calc(100cqw / ${aspectRatio}))`,
  };
  const centered = "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-black [container-type:size]", className)} aria-hidden>
      <div className={cn(centered, "bg-cover bg-center")} style={{ ...coverBox, backgroundImage: `url(${youtubeThumbnail(youtubeId, "maxres")})` }} />
      <div className="bg-video-reveal absolute inset-0" data-revealed={playing || undefined}>
        <iframe
          ref={iframeRef}
          src={embedSrc(youtubeId)}
          title="Background video"
          tabIndex={-1}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          style={coverBox}
          // max-w-none: the base layer caps iframes at max-width: 100%, which would undo the cover width.
          className={cn(centered, "block max-w-none border-0")}
        />
      </div>
    </div>
  );
}
