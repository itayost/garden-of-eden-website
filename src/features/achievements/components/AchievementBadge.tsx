"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AchievementBadgeProps } from "../types";
import { RARITY_COLORS } from "../lib/config/badge-config";
import { formatUnlockedDate } from "../lib/utils/achievement-utils";

/**
 * Single achievement badge display component
 */
export function AchievementBadge({
  achievement,
  size = "md",
  showTooltip = true,
}: AchievementBadgeProps) {
  const colors = RARITY_COLORS[achievement.rarity];

  const sizeClasses = {
    sm: "w-10 h-10 text-lg",
    md: "w-14 h-14 text-2xl",
    lg: "w-20 h-20 text-4xl",
  };

  const badge = (
    <div
      className={cn(
        "rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110",
        colors.bg,
        colors.border,
        sizeClasses[size]
      )}
    >
      <span role="img" aria-label={achievement.nameHe}>
        {achievement.emoji}
      </span>
    </div>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="text-center max-w-xs">
          <p className="font-semibold">{achievement.nameHe}</p>
          <p className="text-xs text-muted-foreground">
            {achievement.descriptionHe}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            הושג ב-{formatUnlockedDate(achievement.unlocked_at)}
          </p>
          <p className={cn("text-xs font-medium mt-1", colors.text)}>
            +{achievement.points} נקודות
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Locked badge placeholder
 */
export function LockedBadge({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-10 h-10 text-lg",
    md: "w-14 h-14 text-2xl",
    lg: "w-20 h-20 text-4xl",
  };

  return (
    <div
      className={cn(
        "rounded-full border-2 border-dashed border-gray-300 bg-gray-100 flex items-center justify-center opacity-40",
        sizeClasses[size]
      )}
    >
      <span className="text-gray-400">?</span>
    </div>
  );
}
