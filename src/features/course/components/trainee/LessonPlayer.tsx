"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLessonPlaybackUrl } from "@/features/course/lib/actions/course-playback";
import { updateLessonProgress } from "@/features/course/lib/actions/course-progress";
import { shouldMarkComplete } from "@/features/course/lib/progress-utils";
import type { VideoQuality } from "@/features/course/lib/types";

interface LessonPlayerProps {
  lessonId: string;
  durationSec: number;
  initialPositionSec: number;
  initialCompleted: boolean;
  hasSdRendition: boolean;
  onCompletedChange?: (completed: boolean) => void;
}

/** How often an actively playing lesson reports its position. */
const REPORT_INTERVAL_MS = 15_000;

/**
 * Video player for one lesson.
 *
 * Playback URLs are signed and short-lived, so the component fetches one on
 * mount and re-fetches if the element reports a media error — which is what an
 * expired URL looks like from the browser's side.
 *
 * Position is reported on a timer while playing, and on pause, tab-hide and
 * unmount, so closing the tab mid-lesson still records where they got to.
 */
export function LessonPlayer({
  lessonId,
  durationSec,
  initialPositionSec,
  initialCompleted,
  hasSdRendition,
  onCompletedChange,
}: LessonPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [quality, setQuality] = useState<VideoQuality>("hd");
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Bumped to force a re-sign after a media error. */
  const [reloadNonce, setReloadNonce] = useState(0);

  // Derived rather than stored, so the fetch effect never has to call setState
  // synchronously just to raise a spinner.
  const loading = src === null && error === null;

  // Refs, not state: these are read inside event handlers and a timer, and must
  // never trigger a re-render mid-playback.
  const lastReportedRef = useRef(0);
  const completedRef = useRef(initialCompleted);
  const positionRef = useRef(initialPositionSec);
  const retriedRef = useRef(false);

  const report = useCallback(async () => {
    const position = Math.floor(positionRef.current);
    if (position <= 0 || position === lastReportedRef.current) return;
    lastReportedRef.current = position;

    try {
      const result = await updateLessonProgress(lessonId, position);
      if (!result.success) {
        // A rejected write (rate limit, failed save) has to stay retryable for
        // the same reason a thrown one does: otherwise pausing on the exact
        // second that failed means the later pause/unmount flushes dedupe
        // against a position that was never stored, and it is lost.
        lastReportedRef.current = 0;
        return;
      }
      if (result.completed && !completedRef.current) {
        completedRef.current = true;
        onCompletedChange?.(true);
      }
    } catch (error) {
      // A dropped connection must not surface as an unhandled rejection, and the
      // position has to be retryable — otherwise one failed tick silently loses
      // everything watched until the next second boundary.
      console.error("updateLessonProgress call failed:", error);
      lastReportedRef.current = 0;
    }
  }, [lessonId, onCompletedChange]);

  // Fetch a freshly signed URL. State is only touched after the await, so this
  // never cascades a render, and `cancelled` stops a slow response from an old
  // quality setting landing on top of a newer one.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const result = await getLessonPlaybackUrl(lessonId, quality);
        if (cancelled) return;
        if (result.url) {
          setSrc(result.url);
          setError(null);
        } else {
          setError(result.error ?? "לא ניתן לנגן את השיעור");
        }
      } catch (cause) {
        // Without this the spinner would spin forever on a dropped request.
        console.error("getLessonPlaybackUrl call failed:", cause);
        if (!cancelled) setError("לא ניתן לנגן את השיעור כרגע");
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [lessonId, quality, reloadNonce]);

  // Report on a timer while playing, and flush on tab-hide or unmount.
  useEffect(() => {
    const timer = setInterval(() => {
      // `videoRef.current?.paused` is undefined before the element mounts, which
      // read as "playing" and reported a position for a video nobody had started.
      const video = videoRef.current;
      if (video && !video.paused) void report();
    }, REPORT_INTERVAL_MS);

    const onHide = () => {
      if (document.visibilityState === "hidden") void report();
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      void report();
    };
  }, [report]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    retriedRef.current = false;
    // Resume, unless they were essentially at the end — then start over.
    const resumeAt = positionRef.current;
    if (resumeAt > 0 && !shouldMarkComplete(resumeAt, durationSec)) {
      video.currentTime = resumeAt;
    }
  }, [durationSec]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) positionRef.current = video.currentTime;
  }, []);

  const handleError = useCallback(() => {
    // A signed URL that has expired surfaces here as a media error. Re-sign
    // once; a second failure is a real problem worth showing.
    if (retriedRef.current) {
      setError("הניגון נכשל. נסה לרענן את העמוד.");
      return;
    }
    retriedRef.current = true;
    setReloadNonce((n) => n + 1);
  }, []);

  const changeQuality = useCallback((next: VideoQuality) => {
    // Keep the viewer's place across the switch.
    if (videoRef.current) positionRef.current = videoRef.current.currentTime;
    setQuality(next);
  }, []);

  return (
    <div className="space-y-2">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-forest">
        {src && (
          <video
            ref={videoRef}
            src={src}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPause={() => void report()}
            onEnded={() => void report()}
            onError={handleError}
          />
        )}

        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-forest">
            <Loader2
              className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none"
              aria-label="טוען"
            />
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 grid place-items-center bg-forest p-6 text-center">
            <p className="text-sm text-cream">{error}</p>
          </div>
        )}
      </div>

      {hasSdRendition && (
        <div className="flex items-center justify-end gap-1">
          <span className="me-1 text-xs text-muted-foreground">איכות</span>
          {(["hd", "sd"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => changeQuality(option)}
              aria-pressed={quality === option}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-bold transition-colors",
                quality === option
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {option === "hd" ? "רגילה" : "חיסכון"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
