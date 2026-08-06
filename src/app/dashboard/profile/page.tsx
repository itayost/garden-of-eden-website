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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    .select("full_name, birthdate, position, avatar_url, processed_avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const avatarUrl = profile?.processed_avatar_url ?? profile?.avatar_url ?? null;
  const initial = (profile?.full_name ?? "מ").slice(0, 1);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl text-forest">פרופיל</h1>
        <p className="text-sm text-muted-foreground">
          עדכנו את הפרטים האישיים שלכם
        </p>
      </div>

      {/* The identity that feeds the player card, made visible: this is what
          the avatar and position on the FIFA card come from. */}
      <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-l from-forest to-forest-light px-4 py-4 text-cream">
        <Avatar className="h-16 w-16 border-2 border-gold/60">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback className="bg-gold/20 text-xl text-gold-light">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-display text-xl">
            {profile?.full_name ?? "מתאמן"}
          </p>
          <p className="text-xs text-cream/70">
            {profile?.position
              ? `עמדה: ${profile.position} · מזין את כרטיס השחקן שלך`
              : "הפרטים כאן מזינים את כרטיס השחקן שלך"}
          </p>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-forest">
              <UserCog className="h-5 w-5 text-gold-light" />
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
