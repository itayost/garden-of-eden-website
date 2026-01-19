"use client";

import { Target } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { GoalsListProps } from "../types";
import { GoalCard } from "./GoalCard";
import { GoalCelebrationClient } from "./GoalCelebrationClient";

/**
 * Displays a list of goals
 * Used on player dashboard
 */
export function GoalsList({ goals, userId, variant = "dashboard" }: GoalsListProps) {
  // Separate active and achieved goals
  const activeGoals = goals.filter((g) => !g.is_achieved);
  const achievedGoals = goals.filter((g) => g.is_achieved);

  if (goals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            היעדים שלי
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>אין יעדים פעילים כרגע</p>
            <p className="text-sm">המאמן יוכל להגדיר לך יעדים חדשים</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isDashboard = variant === "dashboard";

  return (
    <>
      <GoalCelebrationClient goals={goals} userId={userId} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            היעדים שלי
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeGoals.length > 0 && (
            <div className="space-y-3">
              {!isDashboard && (
                <h3 className="text-sm font-medium text-muted-foreground">
                  יעדים פעילים
                </h3>
              )}
              {activeGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  compact={isDashboard}
                />
              ))}
            </div>
          )}

          {achievedGoals.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                יעדים שהושגו
              </h3>
              {achievedGoals.slice(0, isDashboard ? 2 : undefined).map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  compact={isDashboard}
                />
              ))}
              {isDashboard && achievedGoals.length > 2 && (
                <p className="text-xs text-muted-foreground text-center">
                  + {achievedGoals.length - 2} יעדים נוספים שהושגו
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
