"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QUICK_TAG_KEYS, type QuickTagKey, type SlotTags, type TraineeTags } from "../lib/tags";
import { getSlotTagsAction, saveQuickTagNoteAction, toggleQuickTagAction } from "../lib/actions/quick-tags";

type LoadState = "idle" | "loading" | "ready" | "error";

/** What came back for one Slot; a result for another Slot is treated as not loaded. */
type Loaded = { slotId: string; tags: SlotTags; failed: boolean };

const EMPTY: TraineeTags = { tags: [], note: null };

/**
 * One Slot's Quick tags for the roster sheet. Loads only while tag mode is on.
 * A tap shows at once; when the server refuses, the toast says why and that
 * Trainee's tags go back to what they were.
 */
export function useSlotTags(slotId: string | null, enabled: boolean) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!slotId || !enabled) return;
    let cancelled = false;
    getSlotTagsAction(slotId)
      .then((result) => {
        if (cancelled) return;
        if ("error" in result) {
          toast.error(result.error);
          setLoaded({ slotId, tags: {}, failed: true });
          return;
        }
        setLoaded({ slotId, tags: result.data, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ slotId, tags: {}, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [slotId, enabled]);

  const current = loaded !== null && loaded.slotId === slotId ? loaded : null;
  const state: LoadState = !slotId || !enabled ? "idle" : current === null ? "loading" : current.failed ? "error" : "ready";
  const tags = current?.tags ?? {};

  const setTrainee = (traineeId: string, next: TraineeTags) =>
    setLoaded((previous) =>
      previous !== null && previous.slotId === slotId
        ? { ...previous, tags: { ...previous.tags, [traineeId]: next } }
        : previous,
    );

  const toggle = (traineeId: string, tag: QuickTagKey) => {
    if (!slotId) return;
    const previous = tags[traineeId] ?? EMPTY;
    const on = !previous.tags.includes(tag);
    const nextTags = on
      ? QUICK_TAG_KEYS.filter((key) => key === tag || previous.tags.includes(key))
      : previous.tags.filter((key) => key !== tag);
    setTrainee(traineeId, { ...previous, tags: nextTags });

    toggleQuickTagAction({ slotId, traineeId, tag, on })
      .then((result) => {
        if ("error" in result) {
          toast.error(result.error);
          setTrainee(traineeId, previous);
        }
      })
      .catch(() => {
        toast.error("שגיאה בשמירת התגית");
        setTrainee(traineeId, previous);
      });
  };

  const saveNote = (traineeId: string, note: string) => {
    if (!slotId) return;
    const previous = tags[traineeId] ?? EMPTY;
    const trimmed = note.trim();
    if (trimmed === (previous.note ?? "")) return;
    setTrainee(traineeId, { ...previous, note: trimmed || null });

    saveQuickTagNoteAction({ slotId, traineeId, note: trimmed })
      .then((result) => {
        if ("error" in result) {
          toast.error(result.error);
          setTrainee(traineeId, previous);
        }
      })
      .catch(() => {
        toast.error("שגיאה בשמירת ההערה");
        setTrainee(traineeId, previous);
      });
  };

  return { tags, state, toggle, saveNote };
}
