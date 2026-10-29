import { useEffect, useRef } from "react";

/**
 * Moves focus to a heading when its screen appears, so a screen reader follows
 * the Trainee from one Question to the next. The heading needs `tabIndex={-1}`.
 * Only on mount: a re-render while typing must never pull focus back.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
