"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { AchievementWithDisplay, UseAchievementCelebrationReturn } from "../types";
import { RARITY_COLORS } from "../lib/config/badge-config";
import { wasBadgeCelebrated, markBadgeCelebrated } from "../lib/utils/achievement-utils";
import { markAchievementsCelebrated } from "../lib/actions/get-achievements";

/**
 * Hook to handle achievement celebration logic
 */
export function useAchievementCelebration(
  achievements: AchievementWithDisplay[]
): UseAchievementCelebrationReturn {
  const [celebratedBadges, setCelebratedBadges] = useState<string[]>([]);

  const checkAndCelebrate = useCallback(() => {
    // Find uncelebrated achievements
    const uncelebrated = achievements.filter(
      (a) =>
        !a.celebrated &&
        !wasBadgeCelebrated(a.id) &&
        !celebratedBadges.includes(a.badge_type)
    );

    if (uncelebrated.length === 0) return;

    const newCelebrated: string[] = [];
    const achievementIds: string[] = [];

    uncelebrated.forEach((achievement, index) => {
      markBadgeCelebrated(achievement.id);
      newCelebrated.push(achievement.badge_type);
      achievementIds.push(achievement.id);

      const colors = RARITY_COLORS[achievement.rarity];

      setTimeout(() => {
        toast.success(
          <div className="flex items-center gap-3">
            <span className="text-3xl">{achievement.emoji}</span>
            <div>
              <p className="font-bold">{achievement.nameHe}</p>
              <p className="text-sm text-muted-foreground">
                {achievement.descriptionHe}
              </p>
              <p className={`text-xs font-medium ${colors.text}`}>
                +{achievement.points} נקודות
              </p>
            </div>
          </div>,
          {
            duration: 5000,
            className: `${colors.bg} ${colors.border} border-2`,
          }
        );
      }, index * 1500);
    });

    setCelebratedBadges((prev) => [...prev, ...newCelebrated]);

    // Mark as celebrated in database
    if (achievementIds.length > 0) {
      markAchievementsCelebrated(achievementIds);
    }
  }, [achievements, celebratedBadges]);

  return {
    checkAndCelebrate,
    celebratedBadges,
  };
}
