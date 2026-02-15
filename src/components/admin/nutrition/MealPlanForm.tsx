"use client";

import { useState, useRef, useActionState } from "react";
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
} from "@/features/nutrition/types";
import {
  DAY_LABELS_HE,
  MEAL_LABELS_HE,
  ORDERED_DAYS,
  ORDERED_MEALS,
  EMPTY_WEEKLY_MEAL_PLAN,
} from "@/features/nutrition";
import { upsertMealPlan } from "@/features/nutrition";

interface MealItem {
  id: number;
  value: string;
}

type DayMealItems = Record<MealCategory, MealItem[]>;
type WeeklyMealItems = Record<DayOfWeek, DayMealItems>;

interface MealPlanFormProps {
  userId: string;
  existingPlan: TraineeMealPlanRow | null;
}

function toMealItems(
  plan: WeeklyMealPlan,
  nextId: () => number
): WeeklyMealItems {
  const result: Record<string, DayMealItems> = {};
  for (const day of ORDERED_DAYS) {
    result[day] = {
      breakfast: (plan[day]?.breakfast || []).map((v) => ({ id: nextId(), value: v })),
      lunch: (plan[day]?.lunch || []).map((v) => ({ id: nextId(), value: v })),
      dinner: (plan[day]?.dinner || []).map((v) => ({ id: nextId(), value: v })),
      snacks: (plan[day]?.snacks || []).map((v) => ({ id: nextId(), value: v })),
    };
  }
  return result as unknown as WeeklyMealItems;
}

function toWeeklyMealPlan(items: WeeklyMealItems): WeeklyMealPlan {
  const result: Record<string, Record<string, string[]>> = {};
  for (const day of ORDERED_DAYS) {
    result[day] = {
      breakfast: items[day].breakfast.map((i) => i.value),
      lunch: items[day].lunch.map((i) => i.value),
      dinner: items[day].dinner.map((i) => i.value),
      snacks: items[day].snacks.map((i) => i.value),
    };
  }
  return result as unknown as WeeklyMealPlan;
}

export function MealPlanForm({ userId, existingPlan }: MealPlanFormProps) {
  const [activeDay, setActiveDay] = useState<DayOfWeek>("sunday");
  const idCounter = useRef(0);
  const nextId = () => ++idCounter.current;

  const [mealItems, setMealItems] = useState<WeeklyMealItems>(() => {
    let counter = 0;
    const getId = () => ++counter;
    const items = toMealItems(
      existingPlan?.meal_plan ?? EMPTY_WEEKLY_MEAL_PLAN,
      getId
    );
    idCounter.current = counter;
    return items;
  });

  const addItem = (day: DayOfWeek, meal: MealCategory) => {
    setMealItems((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: [...prev[day][meal], { id: nextId(), value: "" }],
      },
    }));
  };

  const removeItem = (day: DayOfWeek, meal: MealCategory, id: number) => {
    setMealItems((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: prev[day][meal].filter((item) => item.id !== id),
      },
    }));
  };

  const updateItem = (
    day: DayOfWeek,
    meal: MealCategory,
    id: number,
    value: string
  ) => {
    setMealItems((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: prev[day][meal].map((item) =>
          item.id === id ? { ...item, value } : item
        ),
      },
    }));
  };

  type FormState = { success: boolean; error: string | undefined };

  const [, formAction, isPending] = useActionState(
    async (prevState: FormState, /* formData */ _: FormData) => {
      const plan = toWeeklyMealPlan(mealItems);

      // Clean empty strings and check if any items remain
      let hasItems = false;
      for (const day of ORDERED_DAYS) {
        for (const meal of ORDERED_MEALS) {
          plan[day][meal] = plan[day][meal].filter((v) => v.trim() !== "");
          if (plan[day][meal].length > 0) hasItems = true;
        }
      }

      if (!hasItems) {
        toast.error("יש להוסיף לפחות פריט אחד");
        return prevState;
      }

      const result = await upsertMealPlan(userId, plan);

      if (result.success) {
        toast.success("תוכנית התזונה נשמרה בהצלחה");
      } else {
        toast.error(result.error || "שגיאה בשמירת תוכנית התזונה");
      }

      return { success: result.success, error: result.error };
    },
    { success: false, error: undefined }
  );

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
        <form action={formAction} className="space-y-6">
          <Tabs
            value={activeDay}
            onValueChange={(v) => setActiveDay(v as DayOfWeek)}
          >
            <TabsList className="flex w-full overflow-x-auto scrollbar-hide">
              {ORDERED_DAYS.map((day) => (
                <TabsTrigger key={day} value={day} className="text-xs flex-1 min-w-[40px]">
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
                      {mealItems[day][meal].map((item) => (
                        <div key={item.id} className="flex gap-2">
                          <Input
                            value={item.value}
                            onChange={(e) =>
                              updateItem(day, meal, item.id, e.target.value)
                            }
                            placeholder="הזן פריט..."
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(day, meal, item.id)}
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
