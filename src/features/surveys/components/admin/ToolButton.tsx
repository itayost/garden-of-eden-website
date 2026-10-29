import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ToolButtonProps {
  /** What the button does, for assistive technology; the icon alone says nothing. */
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  /** The smaller square used inside an option row. */
  compact?: boolean;
  /** Lets the list put focus back here after a move or a delete (see useFocusRestore). */
  focusId?: string;
  onClick: () => void;
  children: ReactNode;
}

/** A small icon-only button for moving or removing a row. */
export function ToolButton({
  label,
  disabled = false,
  destructive = false,
  compact = false,
  focusId,
  onClick,
  children,
}: ToolButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        compact && "size-7",
        destructive ? "text-destructive hover:text-destructive" : "text-muted-foreground",
      )}
      disabled={disabled}
      aria-label={label}
      data-focus-id={focusId}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
