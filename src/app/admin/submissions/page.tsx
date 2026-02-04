import { createClient } from "@/lib/supabase/server";
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

interface AdminSubmissionsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminSubmissionsPage({ searchParams }: AdminSubmissionsPageProps) {
  const { tab } = await searchParams;
  const supabase = await createClient();

  // Note: Type assertions needed due to Supabase client type inference limitations
  // with Promise.all patterns. The PostgrestVersion hint in Database type helps
  // but doesn't fully resolve builder-to-result type casting.
  const [
    { data: preWorkout },
    { data: postWorkout },
    { data: nutrition },
    { data: shiftReports },
  ] = await Promise.all([
    supabase
      .from("pre_workout_forms")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(1000) as unknown as { data: PreWorkoutForm[] | null },
    supabase
      .from("post_workout_forms")
      .select("*, trainers(name)")
      .order("submitted_at", { ascending: false })
      .limit(1000) as unknown as { data: PostWorkoutWithTrainer[] | null },
    supabase
      .from("nutrition_forms")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(1000) as unknown as { data: NutritionForm[] | null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("trainer_shift_reports")
      .select("*")
      .order("report_date", { ascending: false })
      .limit(1000) as unknown as { data: TrainerShiftReport[] | null },
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
            לפני אימון ({preWorkout?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="post-workout" className="gap-2">
            <FileText className="h-4 w-4" />
            אחרי אימון ({postWorkout?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="nutrition" className="gap-2">
            <Salad className="h-4 w-4" />
            תזונה ({nutrition?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="shift-reports" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            דוחות משמרת ({shiftReports?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pre-workout">
          <PreWorkoutContent submissions={preWorkout || []} />
        </TabsContent>

        <TabsContent value="post-workout">
          <PostWorkoutContent submissions={postWorkout || []} />
        </TabsContent>

        <TabsContent value="nutrition">
          <NutritionContent submissions={nutrition || []} />
        </TabsContent>

        <TabsContent value="shift-reports">
          <ShiftReportContent submissions={shiftReports || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
