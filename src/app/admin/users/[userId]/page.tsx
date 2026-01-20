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
import { Badge } from "@/components/ui/badge";
import { ArrowRight, User, History } from "lucide-react";
import { UserEditForm } from "@/components/admin/UserEditForm";
import { ActivityLogTable } from "@/components/admin/ActivityLogTable";
import type { Profile } from "@/types/database";

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

  if (currentProfile?.role !== "admin") {
    redirect("/dashboard");
  }

  // Get user to edit
  const { data: userToEdit } = (await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()) as unknown as { data: Profile | null };

  if (!userToEdit) {
    notFound();
  }

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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Link
              href="/admin/users"
              className="hover:text-foreground transition-colors"
            >
              ניהול משתמשים
            </Link>
            <ArrowRight className="h-4 w-4 rotate-180" />
            <span>עריכת משתמש</span>
          </div>
          <h1 className="text-3xl font-bold">
            {userToEdit.full_name || "משתמש ללא שם"}
          </h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/users">
            <ArrowRight className="ml-2 h-4 w-4" />
            חזרה לרשימה
          </Link>
        </Button>
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
              <UserEditForm user={userToEdit} currentUserRole="admin" />
            </CardContent>
          </Card>
        </div>

        {/* User Info Sidebar */}
        <div className="space-y-6">
          {/* User Summary Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">סיכום משתמש</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">סטטוס</span>
                {userToEdit.is_active ? (
                  <Badge className="bg-green-500">פעיל</Badge>
                ) : (
                  <Badge variant="destructive">לא פעיל</Badge>
                )}
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
            </CardContent>
          </Card>

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
