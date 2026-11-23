import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/uuid";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badges";
import { ArrowRight, User, History, FileText } from "lucide-react";
import { UserEditForm } from "@/components/admin/UserEditForm";
import { ActivityLogTable } from "@/components/admin/ActivityLogTable";
import { UserActionsCard } from "@/components/admin/users/UserActionsCard";
import { AccessTierCard } from "@/components/admin/users/AccessTierCard";
import { CourseAccessCard } from "@/components/admin/users/CourseAccessCard";
import { getCourseAccessContext } from "@/features/course/lib/course-access-context";
import { TraineeImageSection } from "@/components/admin/users/TraineeImageSection";
import { TraineeNotesCard } from "@/components/admin/users/TraineeNotesCard";
import { CommunicationHistoryCard } from "@/components/admin/users/CommunicationHistoryCard";
import { NextGameAdminCard } from "@/components/admin/NextGameAdminCard";
import { ClipPlaybackCard } from "@/components/admin/ClipPlaybackCard";
import { RadarStatsChartWrapper } from "./RadarStatsChartWrapper";
import { getPlayerRatings } from "@/lib/utils/get-player-ratings";
import { parseAccessOverride } from "@/lib/access/course-access";
import type { Profile, UserRole } from "@/types/database";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { loadBranchIdsByProfile, loadManagedBranchIds } from "@/features/branches/lib/memberships";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchScopeAction } from "@/lib/actions/shared";
import { allowedBranches } from "@/lib/branches/resolve-branch";
import { getPlanForProfileAction } from "@/features/plans/lib/actions/admin-plans";
import { getTraineeHealthAction } from "@/features/plans/lib/actions/trainee-health";
import { UserPlanCard } from "@/features/plans/components/UserPlanCard";
import { canManageBranches, isInBranchScope } from "@/lib/branches/branch-scope";
import { HealthCard } from "@/features/plans/components/HealthCard";
import { TraineeCheckinsCard } from "@/features/checkins/components/TraineeCheckinsCard";
import { TrainingHistoryCard } from "@/features/training-history/components/TrainingHistoryCard";
import { getCurrentProfile, getCurrentUser } from "@/lib/supabase/current-user";

interface UserEditPageProps {
  params: Promise<{ userId: string }>;
}

export default async function UserEditPage({ params }: UserEditPageProps) {
  const { userId } = await params;

  // Validate userId is a proper UUID
  if (!isValidUUID(userId)) {
    notFound();
  }

  const supabase = await createClient();

  // Get current user and verify admin role
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  // The caller's role, the profile being opened, and the branch data the
  // checks below need are independent reads: one round trip for all of them.
  // Memberships are read through the service role: a trainer cannot read
  // another user's profile_branches rows through RLS. Nothing is rendered
  // until the checks below pass.
  const adminClient = createAdminClient();
  const [
    currentProfile,
    { data: userToEdit },
    activeBranches,
    membershipMap,
    scopeResult,
  ] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single() as unknown as Promise<{ data: Profile | null }>,
    listActiveBranchOptionsAction(),
    loadBranchIdsByProfile(adminClient, [userId]),
    getBranchScopeAction(),
  ]);

  if (currentProfile?.role !== "admin" && currentProfile?.role !== "trainer") {
    redirect("/dashboard");
  }

  const isAdmin = currentProfile?.role === "admin";

  if (!userToEdit) {
    notFound();
  }

  // Trainers can only access trainee profiles
  if (!isAdmin && userToEdit.role !== "trainee") {
    redirect("/admin/users");
  }

  if ("error" in scopeResult) redirect("/admin/users");
  const scope = scopeResult.data.scope;
  const initialBranchIds = membershipMap.get(userId) ?? [];

  // A trainer reaches only trainees in their branches, and may toggle only
  // those branches on the form; the action preserves the rest. Same rule as
  // isTraineeInScope(), on the memberships already read above.
  if (!isAdmin && !isInBranchScope(scope, initialBranchIds)) {
    redirect("/admin/users");
  }

  const branches = allowedBranches(scope, activeBranches);
  const isTrainee = userToEdit.role === "trainee";

  // Everything the cards need, at once. The plan and health loaders are
  // branch scoped, so a trainer sees them for their own trainees only.
  const [courseCtx, initialManagedBranchIds, ratingsResult, planRow, health] = await Promise.all([
    // Course access, for the card staff see on a trainee. The rule is on once
    // a good sweep is a week old; until then the card says the old rule holds.
    isTrainee ? getCourseAccessContext() : null,
    // Only an Admin sees or sets which branches a trainer manages.
    isAdmin && userToEdit.role === "trainer"
      ? loadManagedBranchIds(adminClient, userId)
      : ([] as string[]),
    // Player ratings for the radar chart (trainees only)
    isTrainee ? getPlayerRatings(supabase, userToEdit.id) : null,
    isTrainee ? getPlanForProfileAction(userId) : null,
    isTrainee ? getTraineeHealthAction(userId) : null,
  ]);

  const stats = ratingsResult
    ? {
        pace: ratingsResult.ratings.pace,
        shooting: ratingsResult.ratings.shooting,
        passing: ratingsResult.ratings.passing,
        dribbling: ratingsResult.ratings.dribbling,
        defending: ratingsResult.ratings.defending,
        physical: ratingsResult.ratings.physical,
      }
    : null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Link
              href="/admin/users"
              className="hover:text-foreground transition-colors"
            >
              {isAdmin ? "ניהול משתמשים" : "מתאמנים"}
            </Link>
            <ArrowRight className="h-4 w-4 rotate-180" />
            <span>עריכת משתמש</span>
          </div>
          <h1 className="text-3xl font-bold">
            {userToEdit.full_name || "משתמש ללא שם"}
          </h1>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          {userToEdit.role === "trainee" && (
            <Button variant="outline" asChild data-testid="generate-report-link">
              <Link href={`/admin/reports/generate/${userToEdit.id}`}>
                <FileText className="h-4 w-4 ml-2" />
                הפקת סיכום שחקן
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/admin/users">
              <ArrowRight className="ml-2 h-4 w-4" />
              חזרה לרשימה
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Edit Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                עריכת פרטי משתמש
              </CardTitle>
              <CardDescription>
                עדכון פרטים אישיים, תפקיד וסטטוס המשתמש
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserEditForm
                user={userToEdit}
                currentUserRole={currentProfile?.role as UserRole}
                branches={branches}
                initialBranchIds={initialBranchIds}
                initialManagedBranchIds={initialManagedBranchIds}
              />
            </CardContent>
          </Card>

          {/* Trainer Notes (trainees only) */}
          {userToEdit.role === "trainee" && (
            <TraineeNotesCard
              traineeId={userId}
              currentUserId={currentUser.id}
              isAdmin={isAdmin}
            />
          )}

          {/* Communication History (trainees only) */}
          {userToEdit.role === "trainee" && (
            <CommunicationHistoryCard
              traineeId={userId}
              currentUserId={currentUser.id}
              isAdmin={isAdmin}
            />
          )}

          {userToEdit.role === "trainee" && (
            <UserPlanCard
              row={planRow}
              isAdmin={isAdmin}
              canManage={
                planRow !== null &&
                canManageBranches(currentProfile?.role ?? "", scopeResult.data.managedBranchIds, [planRow.plan.branch_id])
              }
              traineeId={userId}
            />
          )}

          {userToEdit.role === "trainee" && <TrainingHistoryCard traineeId={userId} />}

          {userToEdit.role === "trainee" && <TraineeCheckinsCard traineeId={userId} />}

          {health && <HealthCard traineeId={userId} health={health} />}

          {/* Which content this trainee can reach, and why (admin only) */}
          {isAdmin && userToEdit.role === "trainee" && (
            <AccessTierCard
              userId={userId}
              arboxPaidTraining={userToEdit.arbox_paid_training}
              arboxBoughtCourse={userToEdit.arbox_bought_course}
              accessOverride={parseAccessOverride(userToEdit.access_override)}
              arboxUserId={userToEdit.arbox_user_id}
              syncedAt={userToEdit.arbox_access_synced_at}
            />
          )}

          {/* Whether this trainee trains now, and the admin's mark (set by admins; trainers see it) */}
          {courseCtx !== null && (
            <CourseAccessCard
              userId={userId}
              seenTrainingOn={userToEdit.course_seen_training_on}
              accessUntil={userToEdit.course_access_until}
              lastGoodSweepOn={courseCtx.lastGoodSweepOn}
              canEdit={isAdmin}
              today={courseCtx.today}
            />
          )}

          {/* User Actions (admin only) */}
          {isAdmin && (
            <UserActionsCard
              user={userToEdit}
              currentUserId={currentUser.id}
            />
          )}
        </div>

        {/* User Info Sidebar */}
        <div className="space-y-6">
          {/* Profile Image Section */}
          <TraineeImageSection
            traineeUserId={userId}
            traineeName={userToEdit.full_name || "משתמש"}
            currentAvatarUrl={userToEdit.avatar_url}
          />

          {/* User Summary Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">סיכום משתמש</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">סטטוס</span>
                <StatusBadge isActive={userToEdit.is_active} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">נרשם בתאריך</span>
                <span className="text-sm">{formatDate(userToEdit.created_at)}</span>
              </div>
              {userToEdit.updated_at && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">עודכן לאחרונה</span>
                  <span className="text-sm">{formatDate(userToEdit.updated_at)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">פרופיל הושלם</span>
                <span className="text-sm">
                  {userToEdit.profile_completed ? "כן" : "לא"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">הודעת ברוכים הבאים</span>
                <span className="text-sm">
                  {userToEdit.welcome_message_sent_at
                    ? `נשלחה ${formatDate(userToEdit.welcome_message_sent_at)}`
                    : "לא נשלחה"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Next Game (trainees only) */}
          {userToEdit.role === "trainee" && (
            <NextGameAdminCard userId={userId} />
          )}

          {/* Trainee Clip (trainees only) */}
          {userToEdit.role === "trainee" && (
            <ClipPlaybackCard userId={userId} />
          )}

          {/* Player Radar Chart (trainees only) */}
          {userToEdit.role === "trainee" && stats && (
            <Card>
              <CardHeader>
                <CardTitle>דירוג שחקן</CardTitle>
              </CardHeader>
              <CardContent>
                <RadarStatsChartWrapper stats={stats} />
              </CardContent>
            </Card>
          )}

          {/* Activity Log */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                היסטוריית פעילות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityLogTable userId={userId} limit={10} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
