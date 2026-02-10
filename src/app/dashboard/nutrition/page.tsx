import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Utensils, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SleepChart,
  MealPlanPdfViewer,
  NutritionRecommendations,
  getNutritionData,
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

  const nutritionData = await getNutritionData(user.id);

  const allEmpty =
    nutritionData.sleepData.length === 0 &&
    !nutritionData.mealPlan &&
    !nutritionData.recommendation;

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

      {allEmpty ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center text-center py-12 space-y-4">
            <div className="bg-muted rounded-full p-4">
              <Utensils className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">
                עדיין אין נתוני תזונה
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                מלאו שאלוני טרום אימון כדי לראות נתוני שינה. תוכנית התזונה
                וההמלצות יופיעו כאן לאחר שהמאמן יכין אותן עבורכם.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/forms/pre-workout">
                <ClipboardCheck className="h-4 w-4 ml-2" />
                מלאו שאלון טרום אימון
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <SleepChart data={nutritionData.sleepData} />

          <MealPlanPdfViewer mealPlan={nutritionData.mealPlan} />

          <NutritionRecommendations
            recommendation={nutritionData.recommendation}
          />
        </>
      )}
    </div>
  );
}
