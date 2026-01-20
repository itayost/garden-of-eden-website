"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import type { AchievementsListProps } from "../types";
import { AchievementBadge, LockedBadge } from "./AchievementBadge";
import {
  BADGE_CONFIGS,
  CATEGORY_LABELS,
  getTotalPossiblePoints,
} from "../lib/config/badge-config";
import {
  calculateTotalPoints,
  groupAchievementsByCategory,
  getLockedBadges,
} from "../lib/utils/achievement-utils";
import type { AchievementBadgeType } from "@/types/database";

/**
 * List of achievement badges
 */
export function AchievementsList({
  achievements,
  variant = "grid",
  showLocked = false,
}: AchievementsListProps) {
  const totalPoints = calculateTotalPoints(achievements);
  const maxPoints = getTotalPossiblePoints();
  const earnedBadgeTypes = achievements.map((a) => a.badge_type);
  const lockedBadges = showLocked ? getLockedBadges(earnedBadgeTypes) : [];

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap gap-2">
        {achievements.slice(0, 5).map((achievement) => (
          <AchievementBadge
            key={achievement.id}
            achievement={achievement}
            size="sm"
          />
        ))}
        {achievements.length > 5 && (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
            +{achievements.length - 5}
          </div>
        )}
      </div>
    );
  }

  if (variant === "showcase") {
    // Show recent 3 badges prominently
    const recentBadges = achievements.slice(0, 3);

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            הישגים ({achievements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-3">
              {recentBadges.map((achievement) => (
                <AchievementBadge
                  key={achievement.id}
                  achievement={achievement}
                  size="md"
                />
              ))}
              {recentBadges.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  עדיין אין הישגים. המשיכו להתאמן!
                </p>
              )}
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold">{totalPoints}</p>
              <p className="text-xs text-muted-foreground">נקודות</p>
            </div>
          </div>
          {achievements.length > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (totalPoints / maxPoints) * 100)}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full grid view with categories
  const grouped = groupAchievementsByCategory(achievements);

  return (
    <div className="space-y-6">
      {/* Points summary */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">סה״כ נקודות</p>
                <p className="text-2xl font-bold">{totalPoints}</p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-sm text-muted-foreground">הישגים שהושגו</p>
              <p className="text-2xl font-bold">
                {achievements.length} / {Object.keys(BADGE_CONFIGS).length}
              </p>
            </div>
          </div>
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalPoints / maxPoints) * 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Badges by category */}
      {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
        const categoryAchievements = grouped[category] || [];
        const categoryLockedBadges = showLocked
          ? lockedBadges.filter(
              (type) => BADGE_CONFIGS[type].category === category
            )
          : [];

        if (categoryAchievements.length === 0 && categoryLockedBadges.length === 0) {
          return null;
        }

        return (
          <div key={category}>
            <h3 className="text-lg font-semibold mb-3">{label}</h3>
            <div className="flex flex-wrap gap-3">
              {categoryAchievements.map((achievement) => (
                <AchievementBadge
                  key={achievement.id}
                  achievement={achievement}
                  size="md"
                />
              ))}
              {categoryLockedBadges.map((badgeType) => (
                <LockedBadge key={badgeType} size="md" />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Mini achievements card for dashboard
 */
export function AchievementsCard({
  achievements,
}: {
  achievements: { id: string; badge_type: string; unlocked_at: string; celebrated: boolean }[];
}) {
  const totalPoints = achievements.reduce((sum, a) => {
    const config = BADGE_CONFIGS[a.badge_type as AchievementBadgeType];
    return sum + (config?.points || 0);
  }, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1 text-muted-foreground text-sm">
          <Trophy className="h-4 w-4 text-yellow-500" />
          הישגים
        </div>
        <CardTitle className="text-3xl">{achievements.length}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          {totalPoints} נקודות
        </p>
      </CardContent>
    </Card>
  );
}
