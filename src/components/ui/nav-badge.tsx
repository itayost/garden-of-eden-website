import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Counts above this render as "9+" so the bottom bar does not reflow. */
const MAX_DISPLAY = 9;

interface NavBadgeProps {
  count: number;
  className?: string;
}

/**
 * Attention count on a navigation item. Shared by the sidebar, the mobile
 * bottom bar and the mobile "more" sheet so all three stay consistent and the
 * Hebrew screen-reader label is written once.
 *
 * Renders nothing at zero, so callers can pass a count unconditionally.
 */
export function NavBadge({ count, className }: NavBadgeProps) {
  if (count <= 0) return null;

  return (
    <Badge
      variant="destructive"
      className={cn("px-1.5 py-0 text-[10px] leading-4", className)}
      aria-label={`${count} פריטים דורשים תשומת לב`}
    >
      {count > MAX_DISPLAY ? `${MAX_DISPLAY}+` : count}
    </Badge>
  );
}

/**
 * Dot form, for surfaces with no room for a number — currently the "עוד"
 * trigger, which stands in for several items at once.
 */
export function NavBadgeDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "absolute end-1/4 top-2 h-2 w-2 rounded-full bg-destructive",
        className,
      )}
      aria-hidden="true"
    />
  );
}
