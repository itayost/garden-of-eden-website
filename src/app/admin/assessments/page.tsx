import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardList, Users, Calendar } from "lucide-react";
import { getAssessmentCompleteness, getAgeGroup } from "@/types/assessment";
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
    .order("assessment_date", { ascending: false }) as unknown as { data: PlayerAssessment[] | null };

  // Group assessments by user
  const assessmentsByUser = new Map<string, PlayerAssessment[]>();
  assessments?.forEach((assessment) => {
    const userId = assessment.user_id;
    if (!assessmentsByUser.has(userId)) {
      assessmentsByUser.set(userId, []);
    }
    assessmentsByUser.get(userId)!.push(assessment);
  });

  // Calculate stats
  const totalTrainees = profiles?.length || 0;
  const traineesWithAssessments = profiles?.filter(
    (p) => assessmentsByUser.has(p.id)
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
          {profiles && profiles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>קבוצת גיל</TableHead>
                  <TableHead>מבדקים</TableHead>
                  <TableHead>מבדק אחרון</TableHead>
                  <TableHead>שלמות</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => {
                  const userAssessments = assessmentsByUser.get(profile.id) || [];
                  const latestAssessment = userAssessments[0];
                  const ageGroup = getAgeGroup(profile.birthdate);
                  const completeness = latestAssessment
                    ? getAssessmentCompleteness(latestAssessment)
                    : 0;

                  return (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">
                        {profile.full_name || "ללא שם"}
                      </TableCell>
                      <TableCell>
                        {ageGroup ? (
                          <Badge variant="outline">{ageGroup.label}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            לא הוגדר
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {userAssessments.length}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {latestAssessment ? (
                          <span className="text-sm">
                            {new Date(latestAssessment.assessment_date).toLocaleDateString("he-IL")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">---</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {latestAssessment ? (
                          <Badge
                            variant={
                              completeness >= 80
                                ? "default"
                                : completeness >= 50
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {completeness}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">---</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/assessments/${profile.id}`}>
                              צפייה
                            </Link>
                          </Button>
                          <Button asChild size="sm">
                            <Link href={`/admin/assessments/${profile.id}/new`}>
                              <Plus className="h-4 w-4 ml-1" />
                              מבדק חדש
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              אין שחקנים רשומים
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
