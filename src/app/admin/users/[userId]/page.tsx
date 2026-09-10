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
import { TraineeImageSection } from "@/components/admin/users/TraineeImageSection";
import { TraineeNotesCard } from "@/components/admin/users/TraineeNotesCard";
import { CommunicationHistoryCard } from "@/components/admin/users/CommunicationHistoryCard";
import { NextGameAdminCard } from "@/components/admin/NextGameAdminCard";
import { ClipPlaybackCard } from "@/components/admin/ClipPlaybackCard";
import { RadarStatsChartWrapper } from "./RadarStatsChartWrapper";
import { getPlayerRatings } from "@/lib/utils/get-player-ratings";
import type { Profile, UserRole } from "@/types/database";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchScopeAction } from "@/lib/actions/shared";
import { allowedBranches } from "@/lib/branches/resolve-branch";
import { isTraineeInScope } from "@/features/branches/lib/memberships";
import { getPlanForProfileAction } from "@/features/plans/lib/actions/admin-plans";
import { getTraineeHealthAction } from "@/features/plans/lib/actions/trainee-health";
import { UserPlanCard } from "@/features/plans/components/UserPlanCard";
import { HealthCard } from "@/features/plans/components/HealthCard";

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
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    redirect("/login");
  }

  const { data: currentProfile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single()) as { data: { role: string } | null };

  if (currentProfile?.role !== "admin" && currentProfile?.role !== "trainer") {
    redirect("/dashboard");
  }

  const isAdmin = currentProfile?.role === "admin";

  // Get user to edit
  const { data: userToEdit } = (await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()) as { data: Profile | null };

  if (!userToEdit) {
    notFound();
  }

  // Trainers can only access trainee profiles
  if (!isAdmin && userToEdit.role !== "trainee") {
    redirect("/admin/users");
  }

  // Memberships read through the service role: a trainer cannot read another
  // user's profile_branches rows through RLS, and this page is already gated.
  const adminClient = createAdminClient();
  const [activeBranches, membershipMap, scopeResult] = await Promise.all([
    listActiveBranchOptionsAction(),
    loadBranchIdsByProfile(adminClient, [userId]),
    getBranchScopeAction(),
  ]);
  if ("error" in scopeResult) redirect("/admin/users");
  const scope = scopeResult.data.scope;

  // A trainer reaches only trainees in their branches, and may toggle only
  // those branches on the form; the action preserves the rest.
  if (!isAdmin && !(await isTraineeInScope(adminClient, scope, userId))) {
    redirect("/admin/users");
  }
  const branches = allowedBranches(scope, activeBranches);
  const initialBranchIds = membershipMap.get(userId) ?? [];

  // Compute player ratings for radar chart (trainees only)
  let stats: {
    pace: number | null;
    shooting: number | null;
    passing: number | null;
    dribbling: number | null;
    defending: number | null;
    physical: number | null;
  } | null = null;
  if (userToEdit.role === "trainee") {
    const { ratings } = await getPlayerRatings(supabase, userToEdit.id);
    stats = {
      pace: ratings.pace,
      shooting: ratings.shooting,
      passing: ratings.passing,
      dribbling: ratings.dribbling,
      defending: ratings.defending,
      physical: ratings.physical,
    };
  }

  // Plan rows are admin-only (listPlansAction verifies); health data is
  // scoped per trainee, so a trainer sees it for their own branch.
  const [planRow, health] =
    userToEdit.role === "trainee"
      ? await Promise.all([
          isAdmin ? getPlanForProfileAction(userId) : Promise.resolve(null),
          getTraineeHealthAction(userId),
        ])
      : [null, null];

  const formatDate = (dateStr: string) => {
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

          {planRow && <UserPlanCard row={planRow} isAdmin={isAdmin} />}

          {health && <HealthCard traineeId={userId} health={health} />}

          {/* Which content this trainee can reach, and why (admin only) */}
          {isAdmin && userToEdit.role === "trainee" && (
            <AccessTierCard
              userId={userId}
              arboxPaidTraining={userToEdit.arbox_paid_training}
              arboxBoughtCourse={userToEdit.arbox_bought_course}
              accessOverride={userToEdit.access_override}
              arboxUserId={userToEdit.arbox_user_id}
              syncedAt={userToEdit.arbox_access_synced_at}
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
