"use client";

import { NavBadge } from "@/components/ui/nav-badge";
import { useSidebar } from "@/components/ui/sidebar";
import { CLOSE_MENU_LABEL, menuTriggerLabel } from "@/lib/navigation/menu-trigger-label";
import { cn } from "@/lib/utils";

type BrandMenuTriggerProps = {
  /** Attention count summed across the nav, shown while the rows are out of sight. */
  badgeCount?: number;
};

/**
 * Header menu button for the staff shell: an ink tile with lime bars, in the
 * brand language of the signup page and the player card. On phones it is the
 * only way into the navigation, so it has to read as pressable at a glance.
 * Keeps the sidebar trigger's data attributes so it behaves like one.
 */
export function BrandMenuTrigger({ badgeCount = 0 }: BrandMenuTriggerProps) {
  const { toggleSidebar, isMobile, openMobile, state } = useSidebar();

  // An expanded desktop sidebar already shows the count on the row itself.
  const rowsHidden = isMobile || state === "collapsed";
  const count = rowsHidden ? badgeCount : 0;
  const expanded = isMobile ? openMobile : state === "expanded";

  return (
    <button
      type="button"
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      onClick={toggleSidebar}
      aria-label={expanded ? CLOSE_MENU_LABEL : menuTriggerLabel(count)}
      aria-expanded={expanded}
      className={cn(
        "relative grid size-11 shrink-0 place-items-center rounded-[13px] bg-ink",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_4px_10px_-3px_rgb(26_26_26/0.45)]",
        "transition-[transform,box-shadow] duration-150 ease-out motion-reduce:transition-none",
        "active:translate-y-px active:scale-[0.97]",
        "active:shadow-[inset_0_2px_4px_rgb(0_0_0/0.5),0_1px_2px_rgb(26_26_26/0.3)]",
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <span aria-hidden="true" className="grid w-5 justify-items-start gap-1">
        <span className="h-[2.5px] w-5 rounded-full bg-brand-lime" />
        <span className="h-[2.5px] w-[13px] rounded-full bg-brand-lime" />
        <span className="h-[2.5px] w-5 rounded-full bg-brand-lime" />
      </span>
      <NavBadge
        count={count}
        className="absolute -top-1.5 -end-1.5 ring-2 ring-background"
      />
    </button>
  );
}
