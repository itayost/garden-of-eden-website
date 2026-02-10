import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Profile } from "@/types/database";
import { getNutritionData, SleepChart } from "@/features/nutrition";
import { MealPlanPdfUpload } from "@/components/admin/nutrition/MealPlanPdfUpload";
import { RecommendationForm } from "@/components/admin/nutrition/RecommendationForm";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function AdminTraineeNutritionPage({
  params,
}: PageProps) {
  const { userId } = await params;
  const supabase = await createClient();

  const { data: trainee } = (await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .is("deleted_at", null)
    .single()) as unknown as { data: Profile | null };

  if (!trainee || trainee.role !== "trainee") {
    notFound();
  }

  const nutritionData = await getNutritionData(userId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/nutrition">
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            ניהול תזונה - {trainee.full_name || "ללא שם"}
          </h1>
          <p className="text-muted-foreground">
            עריכת תוכנית תזונה והמלצות
          </p>
        </div>
      </div>

      <SleepChart data={nutritionData.sleepData} />

      <MealPlanPdfUpload
        userId={userId}
        existingPlan={nutritionData.mealPlan}
      />

      <RecommendationForm
        userId={userId}
        existingRecommendation={nutritionData.recommendation}
      />
    </div>
  );
}
