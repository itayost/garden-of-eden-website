"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { AchievementWithDisplay } from "../types";
import { RARITY_COLORS } from "../lib/config/badge-config";
import {
  wasBadgeCelebrated,
  markBadgeCelebrated,
} from "../lib/utils/achievement-utils";
import { markAchievementsCelebrated } from "../lib/actions/get-achievements";

interface AchievementCelebrationClientProps {
  achievements: AchievementWithDisplay[];
}

/**
 * Client component that shows toast celebrations for new achievements
 */
export function AchievementCelebrationClient({
  achievements,
}: AchievementCelebrationClientProps) {
  const celebratedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Find uncelebrated achievements
    const uncelebrated = achievements.filter(
      (a) => !a.celebrated && !wasBadgeCelebrated(a.id) && !celebratedRef.current.has(a.id)
    );

    if (uncelebrated.length === 0) return;

    // Show celebrations with staggered timing
    const achievementIds: string[] = [];
    uncelebrated.forEach((achievement, index) => {
      celebratedRef.current.add(achievement.id);
      markBadgeCelebrated(achievement.id);
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
      }, index * 1500); // Stagger by 1.5 seconds
    });

    // Mark as celebrated in database
    if (achievementIds.length > 0) {
      markAchievementsCelebrated(achievementIds);
    }
  }, [achievements]);

  return null;
}
