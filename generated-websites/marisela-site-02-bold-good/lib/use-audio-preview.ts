"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One shared <audio> element for 30-second song previews (Deezer/iTunes preview URLs).
 * Starting a preview stops the previous one. `progress` is 0..1 for the active preview.
 */
export function useAudioPreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlayingId(null);
    setProgress(0);
  }, []);

  const toggle = useCallback(
    (id: string, url?: string) => {
      if (!url) return;
      if (playingId === id) {
        stop();
        return;
      }
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.volume = 0.85;
      audio.addEventListener("timeupdate", () => {
        if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
      });
      audio.addEventListener("ended", () => {
        setPlayingId(null);
        setProgress(0);
      });
      setProgress(0);
      setPlayingId(id);
      void audio.play().catch(() => {
        setPlayingId(null);
      });
    },
    [playingId, stop],
  );

  return { playingId, progress, toggle, stop };
}
