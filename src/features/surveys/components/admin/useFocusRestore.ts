"use client";

import { useEffect, useRef, type RefObject } from "react";

/** The attribute that names a control focus can be put back on (see focus-targets). */
export const FOCUS_ATTRIBUTE = "data-focus-id";

interface FocusRestore<T extends HTMLElement> {
  /** Goes on the element that holds the list and its add control. */
  listRef: RefObject<T | null>;
  /** Call in the handler that changes the list, with the controls to try, best first. */
  restoreFocus: (ids: readonly string[]) => void;
}

/**
 * Puts keyboard focus back after a list changes shape. A row that moves is
 * re-inserted by the browser, which drops focus, and a deleted row takes its
 * button with it, so without this a keyboard user starts again from the top
 * of the page.
 *
 * After the next render the first listed control that exists and accepts focus
 * gets it. One that is folded away on a phone does not accept focus, so the
 * list can name a fallback after it.
 */
export function useFocusRestore<T extends HTMLElement>(): FocusRestore<T> {
  const listRef = useRef<T>(null);
  const wantedRef = useRef<readonly string[]>([]);

  // Runs after every render, and does nothing unless a handler asked for focus.
  useEffect(() => {
    const wanted = wantedRef.current;
    if (wanted.length === 0) return;
    wantedRef.current = [];
    const controls = Array.from(listRef.current?.querySelectorAll<HTMLElement>(`[${FOCUS_ATTRIBUTE}]`) ?? []);
    for (const id of wanted) {
      const control = controls.find((candidate) => candidate.getAttribute(FOCUS_ATTRIBUTE) === id);
      control?.focus();
      if (control !== undefined && document.activeElement === control) return;
    }
  });

  const restoreFocus = (ids: readonly string[]) => {
    wantedRef.current = ids;
  };

  return { listRef, restoreFocus };
}
