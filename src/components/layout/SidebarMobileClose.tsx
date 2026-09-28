"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { CLOSE_MENU_LABEL } from "@/lib/navigation/menu-trigger-label";

/**
 * Close control for the phone drawer. The drawer sheet hides its own corner
 * button, which left tapping the dimmed backdrop as the only way out. The sheet
 * also stays mounted across client navigation, so this closes it once the page
 * changes, whatever moved it: a nav row, a link in the footer, or router.push.
 * Mounted only while the drawer is open, so the first pathname is the one it
 * opened on.
 */
export function SidebarMobileClose() {
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const openedOn = useRef(pathname);

  useEffect(() => {
    if (isMobile && pathname !== openedOn.current) setOpenMobile(false);
  }, [isMobile, pathname, setOpenMobile]);

  if (!isMobile) return null;

  return (
    <button
      type="button"
      onClick={() => setOpenMobile(false)}
      aria-label={CLOSE_MENU_LABEL}
      className="ms-2 grid size-11 shrink-0 place-items-center rounded-xl border-[1.5px] border-sidebar-border bg-background text-sidebar-foreground shadow-[0_1px_1px_rgb(10_31_10/0.06),0_3px_8px_-4px_rgb(10_31_10/0.25)] transition-transform duration-150 ease-out outline-none active:translate-y-px active:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-sidebar-ring motion-reduce:transition-none"
    >
      <X className="size-5" aria-hidden="true" />
    </button>
  );
}
