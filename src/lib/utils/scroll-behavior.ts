/** Smooth in-page scrolling unless the visitor asked for reduced motion. */
export function scrollBehaviorFor(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}

/** Browser-only: reads (prefers-reduced-motion: reduce) at call time. */
export function preferredScrollBehavior(): ScrollBehavior {
  return scrollBehaviorFor(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
