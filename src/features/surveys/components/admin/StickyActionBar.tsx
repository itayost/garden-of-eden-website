import type { ReactNode } from "react";

/**
 * The row of actions pinned to a phone's bottom edge. It is sticky, not fixed,
 * so it stays inside the page's own column and ends where the page ends; from
 * lg the header holds the actions instead and this row is gone.
 */
export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-sm lg:hidden">
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
