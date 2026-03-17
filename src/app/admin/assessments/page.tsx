import type { Metadata } from "next";
import { AssessmentsContent } from "@/components/admin/assessments/AssessmentsContent";
import { getAssessmentsPaginated } from "@/lib/actions/admin-assessments-list";

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

  // Skip the global fetch when a month is already selected —
  // AssessmentsMonthView fetches its own data client-side.
  const initialData = hasMonth
    ? null
    : await getAssessmentsPaginated({ page: 0, pageSize: PAGE_SIZE });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">מבדקים</h1>
          <p className="text-muted-foreground">ניהול מבדקי שחקנים</p>
        </div>
      </div>

      <AssessmentsContent initialData={initialData} />
    </div>
  );
}
