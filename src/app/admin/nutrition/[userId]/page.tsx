import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Profile, UserRole } from "@/types/database";
import dynamic from "next/dynamic";
import { getNutritionData } from "@/features/nutrition";

const SleepChart = dynamic(
  () => import("@/features/nutrition").then(m => ({ default: m.SleepChart }))
);
import { MealPlanPdfUpload } from "@/components/admin/nutrition/MealPlanPdfUpload";
import { RecommendationForm } from "@/components/admin/nutrition/RecommendationForm";
import { MeasurementsCard } from "@/components/admin/nutrition/MeasurementsCard";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function AdminTraineeNutritionPage({
  params,
}: PageProps) {
  const { userId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const [{ data: trainee }, { data: callerProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .is("deleted_at", null)
      .single() as unknown as Promise<{ data: Profile | null }>,
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .is("deleted_at", null)
      .single() as unknown as Promise<{ data: { role: UserRole } | null }>,
  ]);

  if (!trainee || trainee.role !== "trainee") {
    notFound();
  }

  const currentUserRole: UserRole = callerProfile?.role ?? "trainee";

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

      <MeasurementsCard
        userId={userId}
        dateOfBirth={trainee.birthdate}
        currentUserRole={currentUserRole}
      />

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
