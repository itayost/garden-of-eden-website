"use client";

import { cn } from "@/lib/utils";
import { LEAD_TAB_COLOR_CLASSES, type LeadTab } from "@/types/lead-tabs";

interface LeadTabBadgeProps {
  tab: Pick<LeadTab, "name" | "color"> | null | undefined;
  className?: string;
}

export function LeadTabBadge({ tab, className }: LeadTabBadgeProps) {
  if (!tab) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500",
          className,
        )}
      >
        —
      </span>
    );
  }

  const palette = tab.color
    ? LEAD_TAB_COLOR_CLASSES[tab.color]
    : "bg-gray-100 text-gray-800";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        palette,
        className,
      )}
    >
      {tab.name}
    </span>
  );
}
