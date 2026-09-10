import type { Metadata } from "next";
import { AssessmentsContent } from "@/components/admin/assessments/AssessmentsContent";
import { getAssessmentsPaginated } from "@/lib/actions/admin-assessments-list";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";

export const metadata: Metadata = {
  title: "ניהול מבדקים | Garden of Eden",
};

const PAGE_SIZE = 20;

export default async function AdminAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const hasMonth = Boolean(params.month);

  // Only admins get the branch select; a trainer's list is already scoped.
  const { profile } = await verifyAdminOrTrainer();
  const isAdmin = profile?.role === "admin";
  const branches = isAdmin ? await listActiveBranchOptionsAction() : [];
  const branchParam = typeof params.branch === "string" ? params.branch : undefined;

  // Skip the global fetch when a month is already selected —
  // AssessmentsMonthView fetches its own data client-side.
  const initialData = hasMonth
    ? null
    : await getAssessmentsPaginated({ page: 0, pageSize: PAGE_SIZE, branchId: branchParam });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">מבדקים</h1>
        <p className="text-muted-foreground">ניהול מבדקי שחקנים</p>
      </div>

      <AssessmentsContent initialData={initialData} branches={branches} />
    </div>
  );
}
