export interface AutoplayContext {
  /** navigator.connection.saveData: the visitor asked the browser to save data. */
  saveData: boolean;
  /** (prefers-reduced-motion: reduce) matches. */
  prefersReducedMotion: boolean;
}

/** Decorative video may start on its own only when the visitor has not opted out of data or motion. */
export function canAutoplayVideo({ saveData, prefersReducedMotion }: AutoplayContext): boolean {
  return !saveData && !prefersReducedMotion;
}
