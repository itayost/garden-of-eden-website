import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Utensils } from "lucide-react";
import {
  SleepChart,
  MealPlanDisplay,
  NutritionRecommendations,
  getNutritionData,
} from "@/features/nutrition";

export default async function NutritionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/dashboard/nutrition");
  }

  const nutritionData = await getNutritionData(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Utensils className="h-7 w-7" />
          תזונה
        </h1>
        <p className="text-muted-foreground">
          מעקב אחר שינה, תוכנית תזונה והמלצות אישיות
        </p>
      </div>

      <SleepChart data={nutritionData.sleepData} />

      <MealPlanDisplay
        mealPlan={nutritionData.mealPlan?.meal_plan ?? null}
      />

      <NutritionRecommendations
        recommendation={nutritionData.recommendation}
      />
    </div>
  );
}
