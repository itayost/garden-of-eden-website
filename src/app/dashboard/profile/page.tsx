import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserCog } from "lucide-react";
import { ProfilePersonalForm } from "@/components/dashboard/profile/ProfilePersonalForm";

export const metadata: Metadata = {
  title: "פרופיל | Garden of Eden",
};

export default async function DashboardProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?redirect=/dashboard/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("birthdate, position")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">פרופיל</h1>
        <p className="text-muted-foreground">עדכנו את הפרטים האישיים שלכם</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <UserCog className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">פרטים אישיים</CardTitle>
              <CardDescription>תאריך לידה ועמדה מועדפת</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ProfilePersonalForm
            initialBirthdate={profile?.birthdate ?? null}
            initialPosition={profile?.position ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
