import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { attentionLabel } from "@/lib/navigation/menu-trigger-label";

/** Counts above this render as "9+" so a bar or tile does not reflow. */
const MAX_DISPLAY = 9;

interface NavBadgeProps {
  count: number;
  className?: string;
}

/**
 * Attention count on a navigation item. Shared by the sidebar rows and the
 * staff header menu tile so both stay consistent and the Hebrew screen-reader
 * label is written once.
 *
 * Renders nothing at zero, so callers can pass a count unconditionally.
 */
export function NavBadge({ count, className }: NavBadgeProps) {
  if (count <= 0) return null;

  return (
    <Badge
      variant="destructive"
      className={cn("px-1.5 py-0 text-[10px] leading-4", className)}
      aria-label={attentionLabel(count)}
    >
      {count > MAX_DISPLAY ? `${MAX_DISPLAY}+` : count}
    </Badge>
  );
}
