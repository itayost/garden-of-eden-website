"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Utensils } from "lucide-react";
import type {
  TraineeMealPlanRow,
  DayOfWeek,
  MealCategory,
  WeeklyMealPlan,
  DayMealPlan,
} from "@/features/nutrition/types";
import {
  DAY_LABELS_HE,
  MEAL_LABELS_HE,
  ORDERED_DAYS,
  ORDERED_MEALS,
  EMPTY_WEEKLY_MEAL_PLAN,
} from "@/features/nutrition";
import { upsertMealPlan } from "@/features/nutrition";

interface MealPlanFormProps {
  userId: string;
  existingPlan: TraineeMealPlanRow | null;
}

function deepCloneMealPlan(plan: WeeklyMealPlan): WeeklyMealPlan {
  const result: Record<string, DayMealPlan> = {};
  for (const day of ORDERED_DAYS) {
    result[day] = {
      breakfast: [...(plan[day]?.breakfast || [])],
      lunch: [...(plan[day]?.lunch || [])],
      dinner: [...(plan[day]?.dinner || [])],
      snacks: [...(plan[day]?.snacks || [])],
    };
  }
  return result as WeeklyMealPlan;
}

export function MealPlanForm({ userId, existingPlan }: MealPlanFormProps) {
  const [isPending, startTransition] = useTransition();
  const [activeDay, setActiveDay] = useState<DayOfWeek>("sunday");
  const [mealPlan, setMealPlan] = useState<WeeklyMealPlan>(() =>
    existingPlan?.meal_plan
      ? deepCloneMealPlan(existingPlan.meal_plan)
      : deepCloneMealPlan(EMPTY_WEEKLY_MEAL_PLAN)
  );

  const addItem = (day: DayOfWeek, meal: MealCategory) => {
    setMealPlan((prev) => {
      const next = deepCloneMealPlan(prev);
      next[day][meal].push("");
      return next;
    });
  };

  const removeItem = (day: DayOfWeek, meal: MealCategory, index: number) => {
    setMealPlan((prev) => {
      const next = deepCloneMealPlan(prev);
      next[day][meal].splice(index, 1);
      return next;
    });
  };

  const updateItem = (
    day: DayOfWeek,
    meal: MealCategory,
    index: number,
    value: string
  ) => {
    setMealPlan((prev) => {
      const next = deepCloneMealPlan(prev);
      next[day][meal][index] = value;
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Clean empty strings from arrays before saving
    const cleaned = deepCloneMealPlan(mealPlan);
    for (const day of ORDERED_DAYS) {
      for (const meal of ORDERED_MEALS) {
        cleaned[day][meal] = cleaned[day][meal].filter(
          (item) => item.trim() !== ""
        );
      }
    }

    startTransition(async () => {
      const result = await upsertMealPlan(userId, cleaned);
      if (result.success) {
        toast.success("תוכנית התזונה נשמרה בהצלחה");
      } else {
        toast.error(result.error || "שגיאה בשמירת תוכנית התזונה");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Utensils className="h-5 w-5" />
          תוכנית תזונה שבועית
        </CardTitle>
        <CardDescription>
          הגדירו תוכנית תזונה שבועית - הוסיפו פריטים לכל ארוחה בכל יום
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs
            value={activeDay}
            onValueChange={(v) => setActiveDay(v as DayOfWeek)}
          >
            <TabsList className="grid w-full grid-cols-7">
              {ORDERED_DAYS.map((day) => (
                <TabsTrigger key={day} value={day} className="text-xs">
                  {DAY_LABELS_HE[day]}
                </TabsTrigger>
              ))}
            </TabsList>

            {ORDERED_DAYS.map((day) => (
              <TabsContent key={day} value={day} className="space-y-6 mt-4">
                {ORDERED_MEALS.map((meal) => (
                  <div key={meal} className="space-y-2">
                    <h4 className="text-sm font-medium">
                      {MEAL_LABELS_HE[meal]}
                    </h4>
                    <div className="space-y-2">
                      {mealPlan[day][meal].map((item, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={item}
                            onChange={(e) =>
                              updateItem(day, meal, index, e.target.value)
                            }
                            placeholder="הזן פריט..."
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(day, meal, index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addItem(day, meal)}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 ml-1" />
                        הוסף פריט
                      </Button>
                    </div>
                  </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "שומר..." : "שמור תוכנית"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
