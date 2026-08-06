import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayerCard } from "@/components/player-card";
import { Video, ClipboardCheck, ArrowLeft, Salad, Activity, TrendingUp } from "lucide-react";
import type { Profile, UserStreakRow, PlayerGoalRow } from "@/types/database";
import type { PlayerAssessment } from "@/types/assessment";
import type { PlayerPosition } from "@/types/player-stats";
import { getAgeGroup } from "@/types/assessment";
import { getPlayerRatings } from "@/lib/utils/get-player-ratings";
import { hebrewWeekday } from "@/lib/utils/date";
import { israelToday } from "@/lib/utils/tasks";
import { ActionTile } from "@/components/dashboard/ActionTile";
import { transformToRatingChartData } from "@/features/progress-charts/lib/transforms";
import { RatingMigrationBanner } from "@/components/dashboard/RatingMigrationBanner";
import { StreakCard, StreakCelebrationClient } from "@/features/streak-tracking";
import { GoalsList, calculateGoalProgress } from "@/features/goals";
import { AchievementsCard, AchievementCelebrationClient, enrichAchievement } from "@/features/achievements";
import { PaymentStatusHandler } from "@/components/payments/PaymentStatusHandler";
import { NutritionMeetingBanner } from "@/features/nutrition";
import { NextGameCard } from "@/components/dashboard/NextGameCard";
import { TodayWorkoutCard } from "@/components/dashboard/workout/TodayWorkoutCard";
import { getOwnNextGame } from "@/features/next-game/lib/actions/next-game";
import { ClipUploadCard } from "@/components/dashboard/ClipUploadCard";
import { MentalRecordingsCard } from "@/components/dashboard/MentalRecordingsCard";
import { getOwnClipWithSignedUrl } from "@/features/clips/lib/actions/clips";
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

  const [nextGame, ownClipWithUrl] = await Promise.all([
    getOwnNextGame(),
    getOwnClipWithSignedUrl(),
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
    },
    {
      title: "שאלון אחרי אימון",
      description: "מלאו אחרי כל אימון",
      icon: ClipboardCheck,
      href: "/dashboard/forms/post-workout",
    },
    {
      title: "שאלון תזונה",
      description: hasCompletedNutrition ? "אין צורך למלא שוב" : "חובה באימון ראשון",
      icon: Salad,
      href: "/dashboard/forms/nutrition",
      completed: hasCompletedNutrition,
    },
    {
      title: "סרטוני תרגילים",
      description: "תרגילים לעשות בבית",
      icon: Video,
      href: "/dashboard/videos",
    },
  ];

  const firstName = (profile?.full_name || "מתאמן").split(" ")[0];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Welcome Section — opens like a game's title screen, not a dashboard */}
      <div data-tour="welcome">
        <h1 className="font-display text-3xl text-forest sm:text-4xl">
          היי, {firstName}!
        </h1>
        <p className="text-sm text-muted-foreground">
          {hebrewWeekday(israelToday())} · בוא נעבוד
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

      {/* Today's training session (renders nothing when none was built) */}
      <TodayWorkoutCard />

      {/* Next Game */}
      <NextGameCard
        game={
          nextGame
            ? { game_date: nextGame.game_date, opponent: nextGame.opponent }
            : null
        }
      />

      {/* Trainee Clip */}
      <ClipUploadCard
        clip={
          ownClipWithUrl
            ? {
                uploaded_at: ownClipWithUrl.clip.uploaded_at,
                mime_type: ownClipWithUrl.clip.mime_type,
                signedUrl: ownClipWithUrl.signedUrl,
              }
            : null
        }
      />

      {/* Mental Session Recordings */}
      <MentalRecordingsCard />

      {/* Quick Actions — unified ActionTile grid */}
      <div data-tour="quick-actions">
        <p className="mb-3 text-[11px] font-bold tracking-widest text-muted-foreground">
          פעולות מהירות
        </p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {quickActions.map((action) => (
            <ActionTile
              key={action.href}
              href={action.href}
              icon={action.icon}
              title={action.title}
              subtitle={action.description}
              completed={action.completed}
            />
          ))}
        </div>
      </div>

      {/* Progress zone — the kid's pride cards, finally on fire */}
      <div>
        <p className="mb-3 text-[11px] font-bold tracking-widest text-muted-foreground">
          ההתקדמות שלי
        </p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div data-tour="streak-card">
            <StreakCard streak={streakData} />
          </div>
          <AchievementsCard achievements={achievementsData || []} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <Card className="rounded-2xl py-0">
            <CardContent className="px-3 py-2.5 text-center">
              <p className="text-xl font-extrabold text-forest tabular-nums">
                {preWorkoutCount || 0}
              </p>
              <p className="text-[10px] text-muted-foreground">שאלוני לפני</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl py-0">
            <CardContent className="px-3 py-2.5 text-center">
              <p className="text-xl font-extrabold text-forest tabular-nums">
                {postWorkoutCount || 0}
              </p>
              <p className="text-[10px] text-muted-foreground">שאלוני אחרי</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl py-0">
            <CardContent className="px-3 py-2.5 text-center">
              <p className="text-xl font-extrabold text-forest tabular-nums">
                {videosWatched || 0}
              </p>
              <p className="text-[10px] text-muted-foreground">סרטונים</p>
            </CardContent>
          </Card>
        </div>

        {assessments && assessments.length > 0 && (
          <Link href="/dashboard/assessments" className="mt-3 block">
            <div className="transition-shadow hover:shadow-md">
              <MiniRatingChartWrapper data={ratingHistory} />
            </div>
          </Link>
        )}
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
