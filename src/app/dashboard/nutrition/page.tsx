import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Utensils } from "lucide-react";
import {
  SleepChart,
  MealPlanPdfViewer,
  NutritionRecommendations,
  TraineeMeasurementsHistory,
  getNutritionData,
  getTraineeMeasurements,
} from "@/features/nutrition";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "תזונה | Garden of Eden",
};

export default async function NutritionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/dashboard/nutrition");
  }

  const [nutritionData, measurements] = await Promise.all([
    getNutritionData(user.id),
    getTraineeMeasurements(user.id),
  ]);

  const allEmpty =
    nutritionData.sleepData.length === 0 &&
    !nutritionData.mealPlan &&
    !nutritionData.recommendation &&
    measurements.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-forest">תזונה</h1>
        <p className="text-muted-foreground">
          מעקב אחר שינה, תוכנית תזונה והמלצות אישיות
        </p>
      </div>

      {allEmpty ? (
        <EmptyState
          icon={Utensils}
          title="עדיין אין נתוני תזונה"
          description="מלאו שאלוני טרום אימון כדי לראות נתוני שינה. תוכנית התזונה וההמלצות יופיעו כאן לאחר שהמאמן יכין אותן עבורכם."
          cta={{ label: "מלאו שאלון טרום אימון", href: "/dashboard/forms/pre-workout" }}
        />
      ) : (
        <>
          <SleepChart data={nutritionData.sleepData} />

          <TraineeMeasurementsHistory measurements={measurements} />

          <MealPlanPdfViewer mealPlan={nutritionData.mealPlan} />

          <NutritionRecommendations
            recommendation={nutritionData.recommendation}
          />
        </>
      )}
    </div>
  );
}
