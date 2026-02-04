"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Utensils } from "lucide-react";
import type { WeeklyMealPlan } from "../types";
import {
  DAY_LABELS_HE,
  MEAL_LABELS_HE,
  ORDERED_DAYS,
  ORDERED_MEALS,
} from "../lib/config";

interface MealPlanDisplayProps {
  mealPlan: WeeklyMealPlan | null;
}

export function MealPlanDisplay({ mealPlan }: MealPlanDisplayProps) {
  if (!mealPlan) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            תוכנית תזונה שבועית
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          המאמן שלך עדיין לא הגדיר תוכנית תזונה
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Utensils className="h-5 w-5" />
          תוכנית תזונה שבועית
        </CardTitle>
        <CardDescription>
          תוכנית אישית שהוכנה עבורך על ידי המאמן
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {(() => {
            const visibleDays = ORDERED_DAYS.filter((day) => {
              const dayPlan = mealPlan[day];
              return (
                dayPlan &&
                ORDERED_MEALS.some(
                  (meal) => dayPlan[meal] && dayPlan[meal].length > 0
                )
              );
            });

            return visibleDays.map((day, index) => {
              const dayPlan = mealPlan[day];
              const isLast = index === visibleDays.length - 1;

              return (
                <div key={day} className="space-y-3">
                  <Badge variant="outline" className="text-sm">
                    יום {DAY_LABELS_HE[day]}
                  </Badge>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {ORDERED_MEALS.map((meal) => {
                      const items = dayPlan[meal];
                      if (!items || items.length === 0) return null;

                      return (
                        <div key={meal} className="space-y-1.5">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            {MEAL_LABELS_HE[meal]}
                          </h4>
                          <ul className="space-y-1">
                            {items.map((item, idx) => (
                              <li
                                key={idx}
                                className="text-sm flex items-start gap-2"
                              >
                                <span className="text-primary mt-1">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                  {!isLast && <div className="border-b" />}
                </div>
              );
            });
          })()}
        </div>
      </CardContent>
    </Card>
  );
}
