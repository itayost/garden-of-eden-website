import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Users, Calendar } from "lucide-react";
import { AssessmentsTable } from "@/components/admin/assessments/AssessmentsTable";
import type { PlayerAssessment } from "@/types/assessment";
import type { Profile } from "@/types/database";

export const metadata: Metadata = {
  title: "ניהול מבדקים | Garden of Eden",
};

export default async function AdminAssessmentsPage() {
  const supabase = await createClient();

  // Fetch all trainees with their latest assessment
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "trainee")
    .is("deleted_at", null)
    .order("full_name") as unknown as { data: Profile[] | null };

  // Fetch all assessments to get latest per user
  const { data: assessments } = await supabase
    .from("player_assessments")
    .select("*")
    .is("deleted_at", null)
    .order("assessment_date", { ascending: false }) as unknown as { data: PlayerAssessment[] | null };

  // Group assessments by user (as Record for serialization to client component)
  const assessmentsByUser: Record<string, PlayerAssessment[]> = {};
  assessments?.forEach((assessment) => {
    const userId = assessment.user_id;
    if (!assessmentsByUser[userId]) {
      assessmentsByUser[userId] = [];
    }
    assessmentsByUser[userId].push(assessment);
  });

  // Calculate stats
  const totalTrainees = profiles?.length || 0;
  const traineesWithAssessments = profiles?.filter(
    (p) => assessmentsByUser[p.id]
  ).length || 0;

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
            <div className="text-2xl font-bold">{totalTrainees}</div>
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
              {totalTrainees > 0
                ? `${Math.round((traineesWithAssessments / totalTrainees) * 100)}%`
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
            <div className="text-2xl font-bold">{assessments?.length || 0}</div>
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
            profiles={profiles || []}
            assessmentsByUser={assessmentsByUser}
          />
        </CardContent>
      </Card>
    </div>
  );
}
