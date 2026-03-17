"use client";

import { parseAsInteger, useQueryState } from "nuqs";
import { ClipboardList, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssessmentsTable } from "./AssessmentsTable";
import { MonthPicker } from "./MonthPicker";
import { AssessmentsMonthView } from "./AssessmentsMonthView";
import type { AssessmentsPaginatedResult } from "@/lib/actions/admin-assessments-list";

interface AssessmentsContentProps {
  initialData: AssessmentsPaginatedResult | null;
}

export function AssessmentsContent({ initialData }: AssessmentsContentProps) {
  const [month] = useQueryState("month", parseAsInteger);
  const [year] = useQueryState("year", parseAsInteger);

  const effectiveYear = year ?? new Date().getFullYear();
  const isMonthView = month !== null;

  // Fallback values when initialData is null (month was set on first load)
  const total = initialData?.total ?? 0;
  const traineesWithAssessments = initialData?.traineesWithAssessments ?? 0;
  const totalAssessments = initialData?.totalAssessments ?? 0;
  const initialProfiles = initialData?.profiles ?? [];
  const initialAssessmentsByUser = initialData?.assessmentsByUser ?? {};

  return (
    <div className="space-y-6">
      {/* Month picker — always visible */}
      <MonthPicker />

      {isMonthView ? (
        <AssessmentsMonthView month={month} year={effectiveYear} />
      ) : (
        <>
          {/* Global summary cards — same as before */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">סה&quot;כ שחקנים</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">עם מבדקים</CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{traineesWithAssessments}</div>
                <p className="text-xs text-muted-foreground">
                  {total > 0
                    ? `${Math.round((traineesWithAssessments / total) * 100)}%`
                    : "0%"}{" "}
                  מהשחקנים
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">סה&quot;כ מבדקים</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalAssessments}</div>
              </CardContent>
            </Card>
          </div>

          {/* Existing players table */}
          <Card>
            <CardHeader>
              <CardTitle>שחקנים</CardTitle>
            </CardHeader>
            <CardContent>
              <AssessmentsTable
                initialProfiles={initialProfiles}
                initialAssessmentsByUser={initialAssessmentsByUser}
                initialTotal={total}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
