import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, UserPlus } from "lucide-react";
import { UserCreateForm } from "@/components/admin/users/UserCreateForm";

export default async function AdminCreateUserPage() {
  const supabase = await createClient();

  // Verify admin role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: { role: string } | null };

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" asChild>
        <Link href="/admin/users">
          <ArrowRight className="h-4 w-4 ml-2" />
          חזרה לרשימת משתמשים
        </Link>
      </Button>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">יצירת משתמש חדש</h1>
        <p className="text-muted-foreground">הוספת משתמש חדש למערכת</p>
      </div>

      {/* Form card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            פרטי המשתמש
          </CardTitle>
          <CardDescription>הזן את פרטי המשתמש החדש</CardDescription>
        </CardHeader>
        <CardContent>
          <UserCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
