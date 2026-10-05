"use client";

import { useEffect, useEffectEvent, useState } from "react";

const LOAD_FAILED = "הטעינה נכשלה. סגרו ופתחו שוב.";

/**
 * What a plan dialog shows before staff confirm, loaded again whenever key
 * changes. onLoad seeds the form from the result; an answer that arrives
 * after key moved on is dropped.
 */
export function usePlanPreview<T extends object>(
  key: string,
  load: () => Promise<T | { error: string }>,
  onLoad?: (value: T) => void,
): { preview: T | null; loadError: string | null } {
  const [preview, setPreview] = useState<T | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchPreview = useEffectEvent(load);
  const seed = useEffectEvent((value: T) => onLoad?.(value));

  useEffect(() => {
    let cancelled = false;
    fetchPreview()
      .then((result) => {
        if (cancelled) return;
        if ("error" in result) {
          setLoadError(result.error);
          return;
        }
        setPreview(result);
        seed(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(LOAD_FAILED);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { preview, loadError };
}
