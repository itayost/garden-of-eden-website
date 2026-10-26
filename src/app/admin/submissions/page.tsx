import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Brain, FileText, Salad, ClipboardCheck } from "lucide-react";
import {
  getMentalPaginated,
  getNutritionPaginated,
  getPostWorkoutPaginated,
  getPreWorkoutPaginated,
  getShiftReportsPaginated,
} from "@/lib/actions/admin-submissions-list";
import {
  PreWorkoutContent,
  PostWorkoutContent,
  NutritionContent,
  MentalContent,
} from "@/components/admin/submissions/SubmissionsContent";
import { ShiftReportContent } from "@/components/admin/submissions/ShiftReportContent";
import { getBranchScopeAction } from "@/lib/actions/shared";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { BranchUrlFilter } from "@/features/branches/components/BranchUrlFilter";

const PAGE_SIZE = 20;

interface AdminSubmissionsPageProps {
  searchParams: Promise<{ tab?: string; branch?: string }>;
}

export default async function AdminSubmissionsPage({ searchParams }: AdminSubmissionsPageProps) {
  const { tab, branch } = await searchParams;

  // Trainers see forms from their branches only (none without a branch).
  // Admins get a branch filter that narrows the same way.
  const scopeResult = await getBranchScopeAction();
  // A failed scope read must not widen a trainer's view to the whole academy.
  if ("error" in scopeResult) redirect("/dashboard");
  const showBranchFilter = scopeResult.data.scope.kind === "all";
  const branches = showBranchFilter ? await listActiveBranchOptionsAction() : [];

  // Page 0 of each tab and its count, through the same reads the tabs page
  // with, scope and branch filter included.
  const firstPage = { page: 0, pageSize: PAGE_SIZE, branchId: branch };
  const [
    { items: preWorkout, total: preWorkoutCount },
    { items: postWorkout, total: postWorkoutCount },
    { items: nutrition, total: nutritionCount },
    { items: shiftReports, total: shiftReportsCount },
    { items: mental, total: mentalCount },
  ] = await Promise.all([
    getPreWorkoutPaginated(firstPage),
    getPostWorkoutPaginated(firstPage),
    getNutritionPaginated(firstPage),
    getShiftReportsPaginated(firstPage),
    getMentalPaginated(firstPage),
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
            key={branch ?? "all"}
            initialItems={preWorkout || []}
            initialTotal={preWorkoutCount || 0}
            branchId={branch}
          />
        </TabsContent>

        <TabsContent value="post-workout">
          <PostWorkoutContent
            key={branch ?? "all"}
            initialItems={postWorkout || []}
            initialTotal={postWorkoutCount || 0}
            branchId={branch}
          />
        </TabsContent>

        <TabsContent value="nutrition">
          <NutritionContent
            key={branch ?? "all"}
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
            key={branch ?? "all"}
            initialItems={mental || []}
            initialTotal={mentalCount || 0}
            branchId={branch}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
