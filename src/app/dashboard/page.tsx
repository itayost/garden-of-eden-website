import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayerCard } from "@/components/player-card";
import {
  Video,
  ClipboardCheck,
  ArrowLeft,
  Salad,
  Activity,
  CheckCircle2,
  TrendingUp
} from "lucide-react";
import type { Profile, UserStreakRow, PlayerGoalRow } from "@/types/database";
import type { PlayerAssessment } from "@/types/assessment";
import type { PlayerPosition } from "@/types/player-stats";
import { getAgeGroup } from "@/types/assessment";
import { getPlayerRatings } from "@/lib/utils/get-player-ratings";
import { transformToRatingChartData } from "@/features/progress-charts/lib/transforms";
import { RatingMigrationBanner } from "@/components/dashboard/RatingMigrationBanner";
import { StreakCard, StreakCelebrationClient } from "@/features/streak-tracking";
import { GoalsList, calculateGoalProgress } from "@/features/goals";
import { AchievementsCard, AchievementCelebrationClient, enrichAchievement } from "@/features/achievements";
import { PaymentStatusHandler } from "@/components/payments/PaymentStatusHandler";
import { NutritionMeetingBanner } from "@/features/nutrition";
import type { UserAchievementRow } from "@/types/database";

const MiniRatingChartWrapper = dynamic(
  () => import("./MiniRatingChartWrapper").then(m => ({ default: m.MiniRatingChartWrapper }))
);

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Explicit auth check - redirect if not authenticated
  if (!user) {
    redirect("/auth/login?redirect=/dashboard");
  }

  // Get user's data
  const [
    { data: profile },
    { data: nutritionForm },
    { data: assessments },
    { count: preWorkoutCount },
    { count: postWorkoutCount },
    { count: videosWatched },
    { data: streakData },
    { data: goalsData },
    { data: achievementsData },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, birthdate, position, created_at, processed_avatar_url, avatar_url").eq("id", user?.id || "").single() as unknown as { data: Profile | null },
    supabase.from("nutrition_forms").select("id").eq("user_id", user?.id || "").limit(1).maybeSingle() as unknown as { data: { id: string } | null },
    supabase.from("player_assessments").select("*").eq("user_id", user?.id || "").order("assessment_date", { ascending: true }) as unknown as { data: PlayerAssessment[] | null },
    supabase.from("pre_workout_forms").select("*", { count: "exact", head: true }).eq("user_id", user?.id || "") as unknown as { count: number | null },
    supabase.from("post_workout_forms").select("*", { count: "exact", head: true }).eq("user_id", user?.id || "") as unknown as { count: number | null },
    supabase.from("video_progress").select("*", { count: "exact", head: true }).eq("user_id", user?.id || "").eq("watched", true) as unknown as { count: number | null },
    supabase.from("user_streaks").select("user_id, current_streak, longest_streak, last_activity_date, total_activities").eq("user_id", user?.id || "").single() as unknown as { data: UserStreakRow | null },
    supabase.from("player_goals").select("*").eq("user_id", user?.id || "").order("created_at", { ascending: false }) as unknown as { data: PlayerGoalRow[] | null },
    supabase.from("user_achievements").select("id, achievement_id, badge_type, unlocked_at, celebrated").eq("user_id", user?.id || "").order("unlocked_at", { ascending: false }) as unknown as { data: UserAchievementRow[] | null },
  ]);

  // Calculate goal progress for display
  const goalsWithProgress = (goalsData || []).map(calculateGoalProgress);

  // Enrich achievements with display info
  const achievementsWithDisplay = (achievementsData || []).map(enrichAchievement);

  const hasCompletedNutrition = !!nutritionForm;

  // Age group + FIFA-style ratings: ratings come from the latest snapshot row,
  // which was frozen at assessment write time (stable history, no moving baseline).
  const ageGroup = getAgeGroup(profile?.birthdate || null);
  const hasAssessments = assessments && assessments.length > 0;
  const calculatedRatings = hasAssessments && user
    ? (await getPlayerRatings(supabase, user.id)).ratings
    : null;
  const ratingHistory = hasAssessments && user
    ? await transformToRatingChartData(supabase, user.id)
    : [];

  const quickActions = [
    {
      title: "שאלון לפני אימון",
      description: "מלאו לפני כל אימון",
      icon: Activity,
      href: "/dashboard/forms/pre-workout",
      color: "bg-blue-500",
    },
    {
      title: "שאלון אחרי אימון",
      description: "מלאו אחרי כל אימון",
      icon: ClipboardCheck,
      href: "/dashboard/forms/post-workout",
      color: "bg-green-500",
    },
    {
      title: "שאלון תזונה",
      description: hasCompletedNutrition ? "הושלם" : "חובה באימון ראשון",
      icon: Salad,
      href: "/dashboard/forms/nutrition",
      color: "bg-orange-500",
      completed: hasCompletedNutrition,
    },
    {
      title: "סרטוני תרגילים",
      description: "תרגילים לעשות בבית",
      icon: Video,
      href: "/dashboard/videos",
      color: "bg-purple-500",
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Welcome Section */}
      <div data-tour="welcome">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          שלום, {profile?.full_name || "מתאמן"}! 👋
        </h1>
        <p className="text-muted-foreground">
          ברוכים הבאים לאזור האישי שלך ב-Garden of Eden
        </p>
      </div>

      {hasAssessments && <RatingMigrationBanner />}

      {/* Player Card Section */}
      {calculatedRatings ? (
        <Card className="overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <PlayerCard
                playerName={profile?.full_name || "שחקן"}
                position={(profile?.position as PlayerPosition) || "CM"}
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
              />
              <div className="text-center sm:text-right flex-1">
                <h2 className="text-xl font-semibold mb-2">הכרטיס שלך</h2>
                <p className="text-muted-foreground mb-4">
                  הדירוג מחושב על סמך המבדקים הפיזיים שלך
                </p>
                <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                  <Badge variant="outline" className="text-sm">
                    דירוג: {calculatedRatings.overall_rating ?? "—"}
                  </Badge>
                  {profile?.position && (
                    <Badge variant="outline" className="text-sm">
                      עמדה: {profile.position}
                    </Badge>
                  )}
                  {ageGroup && (
                    <Badge variant="outline" className="text-sm">
                      {ageGroup.label}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">כרטיס שחקן</h3>
              <p className="text-sm text-muted-foreground">
                המאמן שלך יוסיף מבדקים כדי ליצור את הכרטיס שלך
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nutrition Alert */}
      {!hasCompletedNutrition && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="bg-orange-500 rounded-full p-2 shrink-0">
                <Salad className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold">טרם מילאתם שאלון תזונה</p>
                <p className="text-sm text-muted-foreground">
                  יש למלא את השאלון לפני האימון הראשון
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0 self-start sm:self-auto">
              <Link href="/dashboard/forms/nutrition">
                למילוי השאלון
                <ArrowLeft className="mr-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Nutrition Meeting Banner (1 month after registration) */}
      <NutritionMeetingBanner userCreatedAt={profile?.created_at || ""} />

      {/* Quick Actions */}
      <div data-tour="quick-actions">
        <h2 className="text-xl font-semibold mb-4">פעולות מהירות</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
            >
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
                  <div className="flex items-start justify-between mb-2 sm:mb-4">
                    <div className={`${action.color} rounded-xl p-3 group-hover:scale-110 transition-transform`}>
                      <action.icon className="h-6 w-6 text-white" />
                    </div>
                    {action.completed && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        <CheckCircle2 className="h-3 w-3 ml-1" />
                        הושלם
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold mb-1">{action.title}</h3>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4">הסטטיסטיקות שלי</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Mini Rating Chart */}
          {assessments && assessments.length > 0 && (
            <Link href="/dashboard/assessments" className="col-span-2 sm:col-span-1">
              <div className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <MiniRatingChartWrapper data={ratingHistory} />
              </div>
            </Link>
          )}
          {/* Streak Card */}
          <div data-tour="streak-card">
            <StreakCard streak={streakData} />
          </div>
          {/* Achievements Card */}
          <AchievementsCard achievements={achievementsData || []} />
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>שאלונים לפני אימון</CardDescription>
              <CardTitle className="text-3xl">{preWorkoutCount || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>שאלונים אחרי אימון</CardDescription>
              <CardTitle className="text-3xl">{postWorkoutCount || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>סרטונים שנצפו</CardDescription>
              <CardTitle className="text-3xl">{videosWatched || 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Goals Section */}
      {goalsWithProgress.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">היעדים שלי</h2>
          <GoalsList
            goals={goalsWithProgress}
            userId={user?.id || ""}
            variant="dashboard"
          />
        </div>
      )}

      {/* Streak Celebration (client-side toast) */}
      <StreakCelebrationClient streak={streakData} />

      {/* Achievement Celebration (client-side toast) */}
      <AchievementCelebrationClient achievements={achievementsWithDisplay} />

      {/* Payment Status Handler (client-side toast for payment success/cancelled) */}
      <Suspense fallback={null}>
        <PaymentStatusHandler />
      </Suspense>
    </div>
  );
}
