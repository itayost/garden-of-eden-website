"use client";

import type { ComponentProps, ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";

import { DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BUTTON_SHADOW, RAISED, SOFT_TEXT } from "./sheet-styles";

/**
 * The pieces of the Survey sheet. SheetDialogContent keeps the header and the
 * footer pinned while the body scrolls, and drops its own padding, so each
 * piece brings the sheet's side padding (20px on a phone, 28px from sm up).
 * Everything is `relative` so it sits above the PitchMark.
 */

const ICON_BUTTON = cn(
  "grid size-10 flex-none place-items-center rounded-xl transition-colors hover:text-[#F2F5EA]",
  RAISED,
  SOFT_TEXT,
);

/** The top of the sheet: a grab handle on a phone, then a row of controls when it has any. */
export function SheetTop({ children }: { children?: ReactNode }) {
  return (
    <div className="relative px-5 pt-2.5 sm:px-7 sm:pt-6">
      <div aria-hidden="true" className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[#F2F5EA]/30 sm:hidden" />
      {children !== undefined && <div className="flex min-h-10 items-center gap-2.5">{children}</div>}
    </div>
  );
}

/** Closes the sheet: the same as "אחר כך" and Escape. */
export function CloseButton({ className }: { className?: string }) {
  return (
    <DialogClose aria-label="סגירה" className={cn(ICON_BUTTON, className)}>
      <X className="size-[18px]" aria-hidden="true" />
    </DialogClose>
  );
}

/** Back to the previous Question. The chevron points to the start, which is right in RTL. */
export function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label="חזרה" onClick={onClick} disabled={disabled} className={ICON_BUTTON}>
      <ChevronRight className="size-[18px]" aria-hidden="true" />
    </button>
  );
}

export function SheetBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("relative min-h-0 flex-1 overflow-y-auto px-5 sm:px-7", className)}
      {...props}
    />
  );
}

export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("relative px-5 pt-4 pb-7 sm:px-7", className)} {...props} />;
}

type ButtonVariant = "primary" | "ghost" | "outline";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: cn(
    "h-14 bg-brand-lime text-[17px] font-extrabold text-forest hover:bg-brand-lime-hover",
    "disabled:bg-brand-lime/30 disabled:text-forest/70 disabled:shadow-none",
    BUTTON_SHADOW,
  ),
  ghost: cn("h-12 bg-transparent text-[15px] font-semibold hover:text-[#F2F5EA]", SOFT_TEXT),
  outline:
    "h-14 border-[1.5px] border-brand-lime/55 bg-transparent text-[17px] font-extrabold text-brand-lime hover:bg-brand-lime/10",
};

/** A full-width sheet button; 56px tall for the primary and outline kinds. */
export function SheetButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-2xl transition-colors disabled:cursor-not-allowed [&_svg]:size-[18px]",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
