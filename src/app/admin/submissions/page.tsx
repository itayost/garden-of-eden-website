import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Brain, FileText, Salad, ClipboardCheck } from "lucide-react";
import type { PreWorkoutForm, PostWorkoutForm, TrainerShiftReport } from "@/types/database";
import type {
  MentalQuestionnaireWithProfile,
  NutritionFormWithProfile,
} from "@/lib/actions/admin-submissions-list";
import {
  PreWorkoutContent,
  PostWorkoutContent,
  NutritionContent,
  MentalContent,
} from "@/components/admin/submissions/SubmissionsContent";
import { ShiftReportContent } from "@/components/admin/submissions/ShiftReportContent";
import { getBranchScopeAction } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { visibleProfileIds } from "@/features/branches/lib/memberships";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { BranchUrlFilter } from "@/features/branches/components/BranchUrlFilter";

type PostWorkoutWithTrainer = PostWorkoutForm & { trainer: { full_name: string } | null };

const PAGE_SIZE = 20;

interface AdminSubmissionsPageProps {
  searchParams: Promise<{ tab?: string; branch?: string }>;
}

export default async function AdminSubmissionsPage({ searchParams }: AdminSubmissionsPageProps) {
  const { tab, branch } = await searchParams;
  const supabase = await createClient();

  // Trainers see forms from their branches only. Admins (and an unassigned
  // trainer, who fails open) get a branch filter that narrows the same way.
  const scopeResult = await getBranchScopeAction();
  const scope = "success" in scopeResult ? scopeResult.data.scope : { kind: "all" as const };
  const showBranchFilter = scope.kind === "all";
  const visibleIds = await visibleProfileIds(createAdminClient(), scope, branch);
  const branches = showBranchFilter ? await listActiveBranchOptionsAction() : [];
  const narrow = <T,>(q: T): T =>
    visibleIds === null
      ? q
      : (q as { in: (c: string, v: string[]) => T }).in("user_id", visibleIds);

  // Fetch page 0 for each tab + exact counts (much less data than .limit(200))
  const [
    { data: preWorkout, count: preWorkoutCount },
    { data: postWorkout, count: postWorkoutCount },
    { data: nutrition, count: nutritionCount },
    { data: shiftReports, count: shiftReportsCount },
    { data: mental, count: mentalCount },
  ] = await Promise.all([
    narrow(supabase.from("pre_workout_forms").select("*", { count: "exact" }))
      .order("submitted_at", { ascending: false })
      .range(0, PAGE_SIZE - 1) as unknown as { data: PreWorkoutForm[] | null; count: number | null },
    narrow(
      supabase
        .from("post_workout_forms")
        .select("*, trainer:profiles!post_workout_forms_trainer_id_fkey(full_name)", { count: "exact" }),
    )
      .order("submitted_at", { ascending: false })
      .range(0, PAGE_SIZE - 1) as unknown as { data: PostWorkoutWithTrainer[] | null; count: number | null },
    narrow(
      supabase
        .from("nutrition_forms")
        .select("*, profile:profiles!nutrition_forms_user_id_fkey(full_name, birthdate)", { count: "exact" }),
    )
      .order("submitted_at", { ascending: false })
      .range(0, PAGE_SIZE - 1) as unknown as { data: NutritionFormWithProfile[] | null; count: number | null },
    typedFrom(supabase, "trainer_shift_reports")
      .select("*", { count: "exact" })
      .order("report_date", { ascending: false })
      .range(0, PAGE_SIZE - 1) as unknown as { data: TrainerShiftReport[] | null; count: number | null },
    narrow(typedFrom(supabase, "mental_questionnaires").select("*", { count: "exact" }))
      .order("submitted_at", { ascending: false })
      .range(0, PAGE_SIZE - 1) as unknown as { data: MentalQuestionnaireWithProfile[] | null; count: number | null },
  ]);

  const defaultTab = tab || "pre-workout";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">שאלונים</h1>
        <p className="text-muted-foreground">
          צפייה בכל השאלונים שהוגשו
        </p>
        {showBranchFilter && (
          <div className="mt-4 max-w-xs">
            <BranchUrlFilter branches={branches} />
          </div>
        )}
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
          <TabsTrigger value="mental" className="gap-2">
            <Brain className="h-4 w-4" />
            שאלונים מנטליים ({mentalCount || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pre-workout">
          <PreWorkoutContent
            initialItems={preWorkout || []}
            initialTotal={preWorkoutCount || 0}
            branchId={branch}
          />
        </TabsContent>

        <TabsContent value="post-workout">
          <PostWorkoutContent
            initialItems={postWorkout || []}
            initialTotal={postWorkoutCount || 0}
            branchId={branch}
          />
        </TabsContent>

        <TabsContent value="nutrition">
          <NutritionContent
            initialItems={nutrition || []}
            initialTotal={nutritionCount || 0}
            branchId={branch}
          />
        </TabsContent>

        <TabsContent value="shift-reports">
          <ShiftReportContent
            initialItems={shiftReports || []}
            initialTotal={shiftReportsCount || 0}
          />
        </TabsContent>

        <TabsContent value="mental">
          <MentalContent
            initialItems={mental || []}
            initialTotal={mentalCount || 0}
            branchId={branch}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
