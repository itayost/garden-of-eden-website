"use client";

import { useEffect, type RefObject } from "react";
import { canAutoplayVideo } from "@/lib/utils/video-autoplay";

const VISIBLE_THRESHOLD = 0.25;

interface NetworkInformationLike {
  saveData?: boolean;
}

/**
 * Plays a muted video only while it is on screen, so a video below the fold
 * downloads nothing until the visitor scrolls to it. Pair with preload="none"
 * and no autoPlay attribute. When autoplay is not allowed (save-data, reduced
 * motion) or the browser refuses to play, the native controls are shown instead.
 */
export function useInViewAutoplay(ref: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
    const allowed = canAutoplayVideo({
      saveData: connection?.saveData === true,
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });

    if (!allowed) {
      video.controls = true;
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          video.play().catch((error: unknown) => {
            // A play() interrupted by pause() (fast scroll) rejects with AbortError; only a
            // refusal (NotAllowedError, e.g. low-power mode) means the visitor must start it.
            if (error instanceof DOMException && error.name === "NotAllowedError") {
              video.controls = true;
            }
          });
        } else {
          video.pause();
        }
      },
      { threshold: VISIBLE_THRESHOLD },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [ref]);
}
