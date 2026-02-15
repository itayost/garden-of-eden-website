"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { WeeklyMealPlan, DayOfWeek, MealCategory } from "../../types";
import type { Json, Profile } from "@/types/database";
import { isValidUUID } from "@/lib/validations/common";

const VALID_DAYS: DayOfWeek[] = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday",
];
const VALID_MEALS: MealCategory[] = ["breakfast", "lunch", "dinner", "snacks"];

function validateMealPlan(input: unknown): input is WeeklyMealPlan {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }
  const obj = input as Record<string, unknown>;
  for (const day of VALID_DAYS) {
    const dayPlan = obj[day];
    if (typeof dayPlan !== "object" || dayPlan === null || Array.isArray(dayPlan)) {
      return false;
    }
    const meals = dayPlan as Record<string, unknown>;
    for (const meal of VALID_MEALS) {
      const items = meals[meal];
      if (!Array.isArray(items)) return false;
      if (!items.every((item) => typeof item === "string")) return false;
    }
  }
  return true;
}

interface UpsertMealPlanResult {
  success: boolean;
  error?: string;
}

/**
 * Create or update a meal plan for a trainee.
 * Only trainers and admins can manage meal plans.
 */
export async function upsertMealPlan(
  userId: string,
  mealPlan: WeeklyMealPlan
): Promise<UpsertMealPlanResult> {
  if (!isValidUUID(userId)) {
    return { success: false, error: "מזהה משתמש לא תקין" };
  }

  if (!validateMealPlan(mealPlan)) {
    return { success: false, error: "מבנה תוכנית התזונה אינו תקין" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  // Verify caller is trainer or admin
  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: Pick<Profile, "role"> | null };

  if (!profile || !["trainer", "admin"].includes(profile.role)) {
    return { success: false, error: "רק מאמנים יכולים לנהל תוכניות תזונה" };
  }

  // Check if plan already exists
  const { data: existingPlan } = (await supabase
    .from("trainee_meal_plans")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle()) as { data: { id: string } | null };

  if (existingPlan) {
    const { error } = await supabase
      .from("trainee_meal_plans")
      .update({ meal_plan: mealPlan as unknown as Json })
      .eq("id", existingPlan.id);

    if (error) {
      console.error("Error updating meal plan:", error);
      return { success: false, error: "שגיאה בעדכון תוכנית התזונה" };
    }
  } else {
    const { error } = await supabase.from("trainee_meal_plans").insert({
      user_id: userId,
      meal_plan: mealPlan as unknown as Json,
      created_by: user.id,
    });

    if (error) {
      console.error("Error creating meal plan:", error);
      return { success: false, error: "שגיאה ביצירת תוכנית התזונה" };
    }
  }

  revalidatePath("/dashboard/nutrition");
  revalidatePath(`/admin/nutrition/${userId}`);
  revalidatePath("/admin/nutrition");

  return { success: true };
}
