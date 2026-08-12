"use client";

import * as React from "react";

import { DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * A dialog that becomes a bottom sheet on a phone.
 *
 * Long admin forms do not fit a phone viewport, and the base DialogContent is
 * a centered box with no height cap and no scroll — the submit button ends up
 * below the fold with no way to reach it.
 *
 * The switch is pure CSS rather than a useIsMobile branch between Sheet and
 * Dialog: one Radix tree means no SSR/client mismatch, and — more importantly
 * — rotating a phone crosses the breakpoint, which would remount the form and
 * wipe whatever the user had already typed.
 *
 * Padding is dropped from the surface and belongs to the children, so the
 * header and the close button stay pinned while the body scrolls under them.
 * Expected shape:
 *
 *   <SheetDialogContent>
 *     <DialogHeader className="px-4 pt-4 pb-3 text-start sm:px-6 sm:pt-6">…
 *     <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">…
 *
 * svh, not vh: the small viewport is the one that survives the mobile URL bar
 * and the on-screen keyboard, which is exactly the failure being fixed.
 *
 * The safe-area inset is an arbitrary value rather than the global `.pb-safe`
 * class on purpose — that class is unlayered, so it would beat the `sm:`
 * padding reset and follow the surface onto the desktop dialog.
 */
export function SheetDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(
        // Phone: pinned to the bottom edge, full width, sliding up.
        "top-auto bottom-0 flex max-h-[90svh] w-full max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none p-0 pb-[env(safe-area-inset-bottom,0px)]",
        "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
        // Tablet and up: the ordinary centered dialog.
        "sm:top-[50%] sm:bottom-auto sm:max-h-[85vh] sm:max-w-lg sm:-translate-y-1/2 sm:rounded-lg sm:pb-0",
        "sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0",
        className,
      )}
      {...props}
    >
      {children}
    </DialogContent>
  );
}
