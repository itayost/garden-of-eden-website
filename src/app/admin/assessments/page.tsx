import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Users, Calendar } from "lucide-react";
import { AssessmentsTable } from "@/components/admin/assessments/AssessmentsTable";
import { getAssessmentsPaginated } from "@/lib/actions/admin-assessments-list";

export const metadata: Metadata = {
  title: "ניהול מבדקים | Garden of Eden",
};

const PAGE_SIZE = 20;

export default async function AdminAssessmentsPage() {
  const result = await getAssessmentsPaginated({ page: 0, pageSize: PAGE_SIZE });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">מבדקים</h1>
          <p className="text-muted-foreground">ניהול מבדקי שחקנים</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה&quot;כ שחקנים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{result.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">עם מבדקים</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{result.traineesWithAssessments}</div>
            <p className="text-xs text-muted-foreground">
              {result.total > 0
                ? `${Math.round((result.traineesWithAssessments / result.total) * 100)}%`
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
            <div className="text-2xl font-bold">{result.totalAssessments}</div>
          </CardContent>
        </Card>
      </div>

      {/* Players Table */}
      <Card>
        <CardHeader>
          <CardTitle>שחקנים</CardTitle>
        </CardHeader>
        <CardContent>
          <AssessmentsTable
            initialProfiles={result.profiles}
            initialAssessmentsByUser={result.assessmentsByUser}
            initialTotal={result.total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
