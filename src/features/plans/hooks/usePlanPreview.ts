"use client";

import { useEffect, useEffectEvent, useState } from "react";

const LOAD_FAILED = "הטעינה נכשלה. סגרו ופתחו שוב.";

type Loaded<T> = { key: string; preview: T | null; loadError: string | null };

/**
 * What a plan dialog shows before staff confirm, loaded again whenever key
 * changes. onLoad seeds the form from the result; an answer that arrives
 * after key moved on is dropped, and while the new one loads the dialog sees
 * nothing, never the answer for the old key (staff could confirm on it).
 * A null key loads nothing, for a form not yet filled in.
 */
export function usePlanPreview<T extends object>(
  key: string | null,
  load: () => Promise<T | { error: string }>,
  onLoad?: (value: T) => void,
): { preview: T | null; loadError: string | null } {
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const fetchPreview = useEffectEvent(load);
  const seed = useEffectEvent((value: T) => onLoad?.(value));

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    fetchPreview()
      .then((result) => {
        if (cancelled) return;
        if ("error" in result) {
          setLoaded({ key, preview: null, loadError: result.error });
          return;
        }
        setLoaded({ key, preview: result, loadError: null });
        seed(result);
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, preview: null, loadError: LOAD_FAILED });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const current = key !== null && loaded?.key === key ? loaded : null;
  return { preview: current?.preview ?? null, loadError: current?.loadError ?? null };
}
