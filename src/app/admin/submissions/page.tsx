import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, FileText, Salad, ClipboardCheck } from "lucide-react";
import type { PreWorkoutForm, PostWorkoutForm, NutritionForm, TrainerShiftReport } from "@/types/database";
import {
  PreWorkoutContent,
  PostWorkoutContent,
  NutritionContent,
} from "@/components/admin/submissions/SubmissionsContent";
import { ShiftReportContent } from "@/components/admin/submissions/ShiftReportContent";

type PostWorkoutWithTrainer = PostWorkoutForm & { trainers: { name: string } | null };

const PAGE_SIZE = 20;

interface AdminSubmissionsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminSubmissionsPage({ searchParams }: AdminSubmissionsPageProps) {
  const { tab } = await searchParams;
  const supabase = await createClient();

  // Fetch page 0 for each tab + exact counts (much less data than .limit(200))
  const [
    { data: preWorkout, count: preWorkoutCount },
    { data: postWorkout, count: postWorkoutCount },
    { data: nutrition, count: nutritionCount },
    { data: shiftReports, count: shiftReportsCount },
  ] = await Promise.all([
    supabase
      .from("pre_workout_forms")
      .select("*", { count: "exact" })
      .order("submitted_at", { ascending: false })
      .range(0, PAGE_SIZE - 1) as unknown as { data: PreWorkoutForm[] | null; count: number | null },
    supabase
      .from("post_workout_forms")
      .select("*, trainers(name)", { count: "exact" })
      .order("submitted_at", { ascending: false })
      .range(0, PAGE_SIZE - 1) as unknown as { data: PostWorkoutWithTrainer[] | null; count: number | null },
    supabase
      .from("nutrition_forms")
      .select("*", { count: "exact" })
      .order("submitted_at", { ascending: false })
      .range(0, PAGE_SIZE - 1) as unknown as { data: NutritionForm[] | null; count: number | null },
    typedFrom(supabase, "trainer_shift_reports")
      .select("*", { count: "exact" })
      .order("report_date", { ascending: false })
      .range(0, PAGE_SIZE - 1) as unknown as { data: TrainerShiftReport[] | null; count: number | null },
  ]);

  const defaultTab = tab || "pre-workout";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">שאלונים</h1>
        <p className="text-muted-foreground">
          צפייה בכל השאלונים שהוגשו
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="pre-workout" className="gap-2">
            <Activity className="h-4 w-4" />
            לפני אימון ({preWorkoutCount || 0})
          </TabsTrigger>
          <TabsTrigger value="post-workout" className="gap-2">
            <FileText className="h-4 w-4" />
            אחרי אימון ({postWorkoutCount || 0})
          </TabsTrigger>
          <TabsTrigger value="nutrition" className="gap-2">
            <Salad className="h-4 w-4" />
            תזונה ({nutritionCount || 0})
          </TabsTrigger>
          <TabsTrigger value="shift-reports" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            דוחות משמרת ({shiftReportsCount || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pre-workout">
          <PreWorkoutContent
            initialItems={preWorkout || []}
            initialTotal={preWorkoutCount || 0}
          />
        </TabsContent>

        <TabsContent value="post-workout">
          <PostWorkoutContent
            initialItems={postWorkout || []}
            initialTotal={postWorkoutCount || 0}
          />
        </TabsContent>

        <TabsContent value="nutrition">
          <NutritionContent
            initialItems={nutrition || []}
            initialTotal={nutritionCount || 0}
          />
        </TabsContent>

        <TabsContent value="shift-reports">
          <ShiftReportContent
            initialItems={shiftReports || []}
            initialTotal={shiftReportsCount || 0}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
