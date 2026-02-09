import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { UserDataTable } from "@/components/admin/users/UserDataTable";
import { UserImportDialog } from "@/components/admin/users/UserImportDialog";
import { UserExportButton } from "@/components/admin/users/UserExportButton";
import type { Profile } from "@/types/database";

export const metadata: Metadata = {
  title: "ניהול משתמשים | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
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

  // Fetch users based on role:
  // - Admins see ALL users (including soft-deleted)
  // - Trainers see only trainees
  let query = supabase.from("profiles").select("*");
  if (!isAdmin) {
    query = query.eq("role", "trainee");
  }
  const { data: users, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    console.error("Failed to fetch users:", error);
  }

  const typedUsers = (users || []) as Profile[];
  const params = await searchParams;

  // Count active (non-deleted) users for display
  const activeUserCount = typedUsers.filter((u) => !u.deleted_at).length;

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
          <UserExportButton users={typedUsers.filter((u) => !u.deleted_at)} />
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
            data={typedUsers}
            initialSearch={params.q || ""}
            initialRole={params.role || null}
            initialStatus={params.status || null}
            initialShowDeleted={params.deleted === "true"}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>
    </div>
  );
}
