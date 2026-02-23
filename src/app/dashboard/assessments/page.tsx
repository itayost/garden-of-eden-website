import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "מבדקים | Garden of Eden",
};
import { Calendar, Target, TrendingUp, Activity, BarChart3, GitCompare } from "lucide-react";
import { PlayerCard } from "@/components/player-card/PlayerCard";
import {
  ASSESSMENT_LABELS_HE,
  ASSESSMENT_UNITS,
  COORDINATION_OPTIONS,
  LEG_POWER_OPTIONS,
  BODY_STRUCTURE_OPTIONS,
  getAgeGroup,
  getAssessmentCompleteness,
} from "@/types/assessment";
import { calculateUserRatings } from "@/lib/utils/calculate-user-ratings";
import type { PlayerAssessment } from "@/types/assessment";
import type { Profile } from "@/types/database";
import dynamic from "next/dynamic";

const AssessmentChartsWrapper = dynamic(
  () => import("./AssessmentChartsWrapper").then(m => ({ default: m.AssessmentChartsWrapper }))
);
import { ComparisonSelector } from "@/features/assessment-comparison";

export default async function DashboardAssessmentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/dashboard/assessments");
  }

  // Fetch profile, assessments, and trainee profiles in parallel
  const [{ data: profile }, { data: assessments }, { data: traineeProfiles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single() as unknown as { data: Profile | null },
    supabase
      .from("player_assessments")
      .select("*")
      .eq("user_id", user.id)
      .order("assessment_date", { ascending: true }) as unknown as { data: PlayerAssessment[] | null },
    supabase
      .from("profiles")
      .select("id, birthdate")
      .eq("role", "trainee") as unknown as { data: { id: string; birthdate: string | null }[] | null },
  ]);

  // Get age group
  const ageGroup = getAgeGroup(profile?.birthdate || null);

  // Calculate FIFA-style ratings from assessments with age-group comparison
  const userRatings = await calculateUserRatings(
    user.id,
    assessments || [],
    profile?.birthdate || null,
    supabase,
    traineeProfiles,
  );
  const calculatedRatings = userRatings?.ratings ?? null;
  const groupAssessments = userRatings?.groupAssessments ?? [];

  // Helper functions
  const formatValue = (key: string, value: number | null) => {
    if (value === null || value === undefined) return "---";
    const unit = ASSESSMENT_UNITS[key];
    return unit ? `${value} ${unit}` : value.toString();
  };

  const getCategoricalLabel = (key: string, value: string | null) => {
    if (!value) return "---";
    switch (key) {
      case "coordination":
        return COORDINATION_OPTIONS.find((o) => o.value === value)?.label || value;
      case "leg_power_technique":
        return LEG_POWER_OPTIONS.find((o) => o.value === value)?.label || value;
      case "body_structure":
        return BODY_STRUCTURE_OPTIONS.find((o) => o.value === value)?.label || value;
      default:
        return value;
    }
  };

  const latestAssessment = assessments?.[assessments.length - 1] as PlayerAssessment | undefined;

  // No assessments yet
  if (!assessments || assessments.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">המבדקים שלי</h1>
          <p className="text-muted-foreground">צפייה בהיסטוריית המבדקים שלך</p>
        </div>

        <Card>
          <CardContent className="py-8 sm:py-12">
            <div className="text-center space-y-4">
              <Target className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium">אין מבדקים עדיין</h3>
                <p className="text-muted-foreground">
                  המאמן שלך יוסיף מבדקים כאן לאחר שתעבור הערכה
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Motivational Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <Activity className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">מבדקים פיזיים</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                ספרינטים, קפיצות, גמישות ועוד - כל הנתונים שלך במקום אחד
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">מעקב התקדמות</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                עקוב אחרי השיפור שלך לאורך זמן וראה את ההתקדמות
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Target className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">יעדים אישיים</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                השווה את עצמך לשחקנים אחרים בקבוצת הגיל שלך
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Reverse for history display (newest first)
  const assessmentsForHistory = [...assessments].reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">המבדקים שלי</h1>
        <div className="flex items-center gap-2 mt-1">
          {ageGroup && (
            <Badge variant="outline">{ageGroup.label}</Badge>
          )}
          <span className="text-muted-foreground">
            {assessments.length} מבדקים
          </span>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="progress" dir="rtl">
        <TabsList className="mb-4 sm:mb-6 w-full">
          <TabsTrigger value="progress" className="flex-1 flex items-center justify-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">גרפי התקדמות</span>
            <span className="sm:hidden">התקדמות</span>
          </TabsTrigger>
          <TabsTrigger value="compare" className="flex-1 flex items-center justify-center gap-2">
            <GitCompare className="h-4 w-4" />
            <span className="hidden sm:inline">השוואת מבדקים</span>
            <span className="sm:hidden">השוואה</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 flex items-center justify-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">היסטוריית מבדקים</span>
            <span className="sm:hidden">היסטוריה</span>
          </TabsTrigger>
        </TabsList>

        {/* Progress Charts Tab */}
        <TabsContent value="progress">
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* Left Column - Card Preview (hidden on mobile) */}
            <div className="hidden lg:block space-y-4">
              {calculatedRatings && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">הכרטיס שלי</CardTitle>
                    <CardDescription>מבוסס על המבדק האחרון</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <PlayerCard
                      playerName={profile?.full_name || "שחקן"}
                      position="CM"
                      cardType="gold"
                      overallRating={calculatedRatings.overall_rating}
                      stats={{
                        pace: calculatedRatings.pace,
                        shooting: calculatedRatings.shooting,
                        passing: calculatedRatings.passing,
                        dribbling: calculatedRatings.dribbling,
                        defending: calculatedRatings.defending,
                        physical: calculatedRatings.physical,
                      }}
                      avatarUrl={profile?.processed_avatar_url ?? profile?.avatar_url ?? undefined}
                      linkToStats={false}
                      size="lg"
                    />
                  </CardContent>
                </Card>
              )}

              {latestAssessment && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">מבדק אחרון</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">תאריך</span>
                      <span>
                        {new Date(latestAssessment.assessment_date).toLocaleDateString("he-IL")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">שלמות</span>
                      <Badge variant="outline">
                        {getAssessmentCompleteness(latestAssessment)}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Progress Charts */}
            <div>
              <AssessmentChartsWrapper
                assessments={assessments}
                allAssessmentsInGroup={groupAssessments}
              />
            </div>
          </div>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="compare">
          <ComparisonSelector assessments={assessments} />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* Left Column - Card Preview (hidden on mobile) */}
            <div className="hidden lg:block space-y-4">
              {calculatedRatings && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">הכרטיס שלי</CardTitle>
                    <CardDescription>מבוסס על המבדק האחרון</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <PlayerCard
                      playerName={profile?.full_name || "שחקן"}
                      position="CM"
                      cardType="gold"
                      overallRating={calculatedRatings.overall_rating}
                      stats={{
                        pace: calculatedRatings.pace,
                        shooting: calculatedRatings.shooting,
                        passing: calculatedRatings.passing,
                        dribbling: calculatedRatings.dribbling,
                        defending: calculatedRatings.defending,
                        physical: calculatedRatings.physical,
                      }}
                      avatarUrl={profile?.processed_avatar_url ?? profile?.avatar_url ?? undefined}
                      linkToStats={false}
                      size="lg"
                    />
                  </CardContent>
                </Card>
              )}

              {latestAssessment && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">מבדק אחרון</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">תאריך</span>
                      <span>
                        {new Date(latestAssessment.assessment_date).toLocaleDateString("he-IL")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">שלמות</span>
                      <Badge variant="outline">
                        {getAssessmentCompleteness(latestAssessment)}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Assessment History */}
            <div className="space-y-4">
              {assessmentsForHistory.map((assessment) => {
                const a = assessment as PlayerAssessment;
                const completeness = getAssessmentCompleteness(a);

                return (
                  <Card key={a.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <CardTitle className="text-base">
                            {new Date(a.assessment_date).toLocaleDateString("he-IL", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </CardTitle>
                        </div>
                        <Badge variant={completeness >= 80 ? "default" : "secondary"}>
                          {completeness}% מלא
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                        {/* Sprint Tests */}
                        <div>
                          <h4 className="font-medium mb-2 text-sm text-muted-foreground">
                            מבדקי ספרינט
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>{ASSESSMENT_LABELS_HE.sprint_5m}</span>
                              <span className="font-medium">
                                {formatValue("sprint_5m", a.sprint_5m)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>{ASSESSMENT_LABELS_HE.sprint_10m}</span>
                              <span className="font-medium">
                                {formatValue("sprint_10m", a.sprint_10m)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>{ASSESSMENT_LABELS_HE.sprint_20m}</span>
                              <span className="font-medium">
                                {formatValue("sprint_20m", a.sprint_20m)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Jump Tests */}
                        <div>
                          <h4 className="font-medium mb-2 text-sm text-muted-foreground">
                            מבדקי ניתור
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>{ASSESSMENT_LABELS_HE.jump_2leg_distance}</span>
                              <span className="font-medium">
                                {formatValue("jump_2leg_distance", a.jump_2leg_distance)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>{ASSESSMENT_LABELS_HE.jump_2leg_height}</span>
                              <span className="font-medium">
                                {formatValue("jump_2leg_height", a.jump_2leg_height)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Categorical */}
                        <div>
                          <h4 className="font-medium mb-2 text-sm text-muted-foreground">
                            הערכות
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>{ASSESSMENT_LABELS_HE.coordination}</span>
                              <span className="font-medium">
                                {getCategoricalLabel("coordination", a.coordination)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>{ASSESSMENT_LABELS_HE.body_structure}</span>
                              <span className="font-medium">
                                {getCategoricalLabel("body_structure", a.body_structure)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Mental Notes */}
                      {(a.concentration_notes || a.decision_making_notes || a.work_ethic_notes) && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium mb-2 text-sm text-muted-foreground">
                            הערכה מנטלית
                          </h4>
                          <div className="space-y-2 text-sm">
                            {a.concentration_notes && (
                              <div>
                                <span className="font-medium">{ASSESSMENT_LABELS_HE.concentration_notes}: </span>
                                <span className="text-muted-foreground">{a.concentration_notes}</span>
                              </div>
                            )}
                            {a.decision_making_notes && (
                              <div>
                                <span className="font-medium">{ASSESSMENT_LABELS_HE.decision_making_notes}: </span>
                                <span className="text-muted-foreground">{a.decision_making_notes}</span>
                              </div>
                            )}
                            {a.work_ethic_notes && (
                              <div>
                                <span className="font-medium">{ASSESSMENT_LABELS_HE.work_ethic_notes}: </span>
                                <span className="text-muted-foreground">{a.work_ethic_notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
