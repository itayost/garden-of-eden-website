import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { UserDataTable } from "@/components/admin/users/UserDataTable";
import { UserImportDialog } from "@/components/admin/users/UserImportDialog";
import { UserExportButton } from "@/components/admin/users/UserExportButton";
import type { Profile } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAllBranches, loadBranchIdsByProfile, branchNamesFor } from "@/features/branches/lib/memberships";
import { toBranchOption, type ProfileWithBranches } from "@/types/branches";
import { getBranchScopeAction } from "@/lib/actions/shared";
import { scopedProfileIds } from "@/features/branches/lib/memberships";

export const metadata: Metadata = {
  title: "ניהול משתמשים | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    position?: string;
    branch?: string;
    deleted?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  // Verify admin role before showing user list
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

  // Admins see everyone (including soft-deleted); the branch filter on the
  // table narrows client-side like the other filters. Trainers see trainees
  // in their branches only.
  const adminClient = createAdminClient();
  const scopeResult = await getBranchScopeAction();
  const scope = "success" in scopeResult ? scopeResult.data.scope : { kind: "all" as const };
  const scopedIds = isAdmin ? null : await scopedProfileIds(adminClient, scope);

  let query = supabase.from("profiles").select("*");
  if (!isAdmin) {
    query = query.eq("role", "trainee");
  }
  if (scopedIds !== null) {
    query = query.in("id", scopedIds);
  }
  const { data: users, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    console.error("Failed to fetch users:", error);
  }

  const typedUsers = (users || []) as Profile[];

  // Memberships through the service role: the page is gated above, and a
  // trainer cannot read other users' profile_branches rows through RLS.
  const [allBranches, membershipMap] = await Promise.all([
    loadAllBranches(adminClient),
    loadBranchIdsByProfile(adminClient, typedUsers.map((u) => u.id)),
  ]);
  // Inactive branches still resolve to a name so a deactivated branch is
  // shown on the users that keep it; pickers get active ones only.
  const allBranchOptions = allBranches.map(toBranchOption);
  const activeBranchOptions = allBranches.filter((b) => b.is_active).map(toBranchOption);

  const usersWithBranches: ProfileWithBranches[] = typedUsers.map((user) => {
    const branchIds = membershipMap.get(user.id) ?? [];
    return { ...user, branchIds, branchNames: branchNamesFor(branchIds, allBranchOptions) };
  });

  const params = await searchParams;
  const activeUserCount = usersWithBranches.filter((u) => !u.deleted_at).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {isAdmin ? "ניהול משתמשים" : "מתאמנים"}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? "צפייה וניהול של כל המשתמשים במערכת"
              : "צפייה וניהול המתאמנים"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <UserImportDialog />}
          <UserExportButton users={usersWithBranches.filter((u) => !u.deleted_at)} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isAdmin
              ? `רשימת משתמשים (${activeUserCount})`
              : `רשימת מתאמנים (${activeUserCount})`}
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? "כל המשתמשים הרשומים במערכת"
              : "כל המתאמנים הרשומים במערכת"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserDataTable
            data={usersWithBranches}
            branches={activeBranchOptions}
            initialSearch={params.q || ""}
            initialRole={params.role || null}
            initialStatus={params.status || null}
            initialPosition={params.position || null}
            initialBranch={params.branch || null}
            initialShowDeleted={params.deleted === "true"}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>
    </div>
  );
}
