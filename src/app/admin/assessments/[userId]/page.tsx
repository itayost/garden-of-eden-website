import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isValidUUID } from "@/lib/utils/uuid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Plus, Calendar, Target } from "lucide-react";
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
import {
  calculateNeutralRatings,
  calculateCardRatings,
  calculateGroupStats,
} from "@/lib/assessment-to-rating";
import type { PlayerAssessment } from "@/types/assessment";
import type { Profile, PlayerGoalRow } from "@/types/database";
import { GoalManagementPanel, type PhysicalMetricKey } from "@/features/goals";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function PlayerAssessmentsPage({ params }: PageProps) {
  const { userId } = await params;

  // Validate userId is a proper UUID
  if (!isValidUUID(userId)) {
    notFound();
  }

  const supabase = await createClient();

  // Fetch player profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single() as unknown as { data: Profile | null };

  if (!profile) {
    notFound();
  }

  // Fetch all assessments and goals for this player
  const [{ data: assessments }, { data: goalsData }] = await Promise.all([
    supabase
      .from("player_assessments")
      .select("*")
      .eq("user_id", userId)
      .order("assessment_date", { ascending: false }),
    supabase
      .from("player_goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }) as unknown as { data: PlayerGoalRow[] | null },
  ]);

  // Get age group
  const ageGroup = getAgeGroup(profile.birthdate);

  // For relative ratings, fetch all assessments in the same age group
  let groupStats = null;
  let calculatedRatings = null;

  if (assessments && assessments.length > 0) {
    const latestAssessment = assessments[0] as PlayerAssessment;

    if (ageGroup) {
      // Fetch all players with same age group for comparison
      const { data: ageGroupProfiles } = await supabase
        .from("profiles")
        .select("id, birthdate")
        .eq("role", "trainee") as unknown as { data: { id: string; birthdate: string | null }[] | null };

      const sameAgeGroupIds = ageGroupProfiles
        ?.filter((p) => {
          const pAgeGroup = getAgeGroup(p.birthdate);
          return pAgeGroup?.id === ageGroup.id;
        })
        .map((p) => p.id) || [];

      if (sameAgeGroupIds.length > 0) {
        const { data: groupAssessments } = await supabase
          .from("player_assessments")
          .select("*")
          .in("user_id", sameAgeGroupIds);

        if (groupAssessments && groupAssessments.length > 1) {
          groupStats = calculateGroupStats(groupAssessments as PlayerAssessment[]);
          calculatedRatings = calculateCardRatings(latestAssessment, groupStats);
        }
      }
    }

    // Fallback to neutral ratings (50) if no group comparison available
    if (!calculatedRatings) {
      calculatedRatings = calculateNeutralRatings();
    }
  }

  // Helper to format value with unit
  const formatValue = (key: string, value: number | null) => {
    if (value === null || value === undefined) return "---";
    const unit = ASSESSMENT_UNITS[key];
    return unit ? `${value} ${unit}` : value.toString();
  };

  // Helper to get categorical label
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

  const latestAssessment = assessments?.[0] as PlayerAssessment | undefined;

  // Extract current metrics from latest assessment for goal management
  const currentMetrics: Partial<Record<PhysicalMetricKey, number | null>> = latestAssessment
    ? {
        sprint_5m: latestAssessment.sprint_5m,
        sprint_10m: latestAssessment.sprint_10m,
        sprint_20m: latestAssessment.sprint_20m,
        jump_2leg_distance: latestAssessment.jump_2leg_distance,
        jump_2leg_height: latestAssessment.jump_2leg_height,
        jump_right_leg: latestAssessment.jump_right_leg,
        jump_left_leg: latestAssessment.jump_left_leg,
        blaze_spot_time: latestAssessment.blaze_spot_time,
        flexibility_ankle: latestAssessment.flexibility_ankle,
        flexibility_knee: latestAssessment.flexibility_knee,
        flexibility_hip: latestAssessment.flexibility_hip,
        kick_power_kaiser: latestAssessment.kick_power_kaiser,
      }
    : {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/assessments">
            <ArrowRight className="h-4 w-4 ml-2" />
            חזרה לרשימה
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{profile.full_name || "ללא שם"}</h1>
          <div className="flex items-center gap-2 mt-1">
            {ageGroup && (
              <Badge variant="outline">{ageGroup.label}</Badge>
            )}
            <span className="text-muted-foreground">
              {assessments?.length || 0} מבדקים
            </span>
          </div>
        </div>
        <Button asChild>
          <Link href={`/admin/assessments/${userId}/new`}>
            <Plus className="h-4 w-4 ml-2" />
            מבדק חדש
          </Link>
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left Column - Card Preview */}
        <div className="space-y-4">
          {calculatedRatings ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">כרטיס שחקן</CardTitle>
                <CardDescription>מחושב מהמבדק האחרון</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <PlayerCard
                  playerName={profile.full_name || "שחקן"}
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
                  linkToStats={false}
                  size="md"
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                אין מבדקים עדיין
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

          {/* Goal Management Panel */}
          <GoalManagementPanel
            userId={userId}
            playerName={profile.full_name || "שחקן"}
            currentMetrics={currentMetrics}
            existingGoals={goalsData || []}
          />
        </div>

        {/* Right Column - Assessment History */}
        <div className="space-y-4">
          {assessments && assessments.length > 0 ? (
            assessments.map((assessment) => {
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
                            month: "long",
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
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

                      {/* Agility & Power */}
                      <div>
                        <h4 className="font-medium mb-2 text-sm text-muted-foreground">
                          זריזות וכוח
                        </h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>{ASSESSMENT_LABELS_HE.blaze_spot_time}</span>
                            <span className="font-medium">
                              {formatValue("blaze_spot_time", a.blaze_spot_time)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>{ASSESSMENT_LABELS_HE.kick_power_kaiser}</span>
                            <span className="font-medium">
                              {formatValue("kick_power_kaiser", a.kick_power_kaiser)}
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

                      {/* Flexibility */}
                      <div>
                        <h4 className="font-medium mb-2 text-sm text-muted-foreground">
                          גמישות
                        </h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>{ASSESSMENT_LABELS_HE.flexibility_ankle}</span>
                            <span className="font-medium">
                              {formatValue("flexibility_ankle", a.flexibility_ankle)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>{ASSESSMENT_LABELS_HE.flexibility_knee}</span>
                            <span className="font-medium">
                              {formatValue("flexibility_knee", a.flexibility_knee)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>{ASSESSMENT_LABELS_HE.flexibility_hip}</span>
                            <span className="font-medium">
                              {formatValue("flexibility_hip", a.flexibility_hip)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {a.notes && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium mb-2 text-sm text-muted-foreground">
                          הערות
                        </h4>
                        <p className="text-sm">{a.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="font-medium">אין מבדקים עדיין</h3>
                    <p className="text-sm text-muted-foreground">
                      הוסף מבדק ראשון לשחקן זה
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={`/admin/assessments/${userId}/new`}>
                      <Plus className="h-4 w-4 ml-2" />
                      הוסף מבדק
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
