"use client";

import { useMediaQuery } from "./useMediaQuery";

/**
 * Returns true when viewport is below Tailwind's `md` breakpoint (768px).
 * Returns false during SSR and on desktop.
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
