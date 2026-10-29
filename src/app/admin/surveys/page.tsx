import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { requireSurveyStaff } from "@/features/surveys/lib/actions/staff-access";
import { loadSurveyList } from "@/features/surveys/lib/queries";
import { matchesListFilter, parseListFilter } from "@/features/surveys/lib/state";
import { SurveyListTable } from "@/features/surveys/components/admin/SurveyListTable";
import { SurveyStateFilter } from "@/features/surveys/components/admin/SurveyStateFilter";

export const metadata: Metadata = { title: "סקרים | Garden of Eden" };

const NEW_SURVEY_HREF = "/admin/surveys/new";

interface PageProps {
  searchParams: Promise<{ state?: string }>;
}

export default async function SurveysPage({ searchParams }: PageProps) {
  // Admins and Branch managers; a Branch manager sees only their branches' Surveys.
  const access = await requireSurveyStaff();
  if ("error" in access) redirect("/admin");

  const filter = parseListFilter((await searchParams).state);
  // A failed read throws on purpose: the admin error page, not an empty list.
  const surveys = await loadSurveyList(createAdminClient(), access.viewer, israelToday());
  const rows = surveys.filter((survey) => matchesListFilter(survey.state, filter));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-3xl font-bold">סקרים</h1>
          <p className="text-muted-foreground">שאלות שנשלחו לחניכים, ומה שענו עליהן</p>
        </div>
        {surveys.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <SurveyStateFilter />
            <Button asChild>
              <Link href={NEW_SURVEY_HREF}>
                <Plus aria-hidden />
                סקר חדש
              </Link>
            </Button>
          </div>
        )}
      </header>

      {surveys.length === 0 ? (
        <EmptyState icon={ClipboardList} title="עוד אין סקרים" cta={{ label: "סקר חדש", href: NEW_SURVEY_HREF }} />
      ) : (
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">אין סקרים במצב הזה</p>
          ) : (
            <SurveyListTable rows={rows} />
          )}
          <p className="text-xs text-muted-foreground">
            מנהל סניף רואה כאן רק סקרים שנשלחו לסניף שלו, וגם בהם רק את החניכים של הסניף.
          </p>
        </div>
      )}
    </div>
  );
}
