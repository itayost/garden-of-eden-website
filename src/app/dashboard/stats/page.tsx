import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayerStatsDetail } from "@/components/player-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Trophy, Target } from "lucide-react";
import type { Profile, PlayerStats } from "@/types/database";

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/dashboard/stats");
  }

  const [{ data: profile }, { data: playerStats }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single() as unknown as { data: Profile | null },
    supabase
      .from("player_stats")
      .select("*")
      .eq("user_id", user.id)
      .single() as unknown as { data: PlayerStats | null },
  ]);

  // No stats yet - show placeholder
  if (!playerStats) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">הסטטיסטיקות שלי</h1>
          <p className="text-muted-foreground">
            צפייה בכל הנתונים והמדדים שלך
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <TrendingUp className="h-10 w-10 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl mb-2">עוד אין לך כרטיס שחקן</CardTitle>
            <CardDescription className="max-w-md">
              המאמן שלך יוסיף את הסטטיסטיקות שלך בקרוב.
              המשיכו להתאמן וליצור את הנתונים!
            </CardDescription>

            {/* Motivation cards */}
            <div className="grid sm:grid-cols-2 gap-4 mt-8 w-full max-w-lg">
              <div className="p-4 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20">
                <Trophy className="h-6 w-6 text-[#22C55E] mb-2" />
                <div className="font-semibold text-sm">ממשיכים להתאמן</div>
                <div className="text-xs text-muted-foreground">
                  כל אימון מקרב אותך למטרה
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20">
                <Target className="h-6 w-6 text-[#F59E0B] mb-2" />
                <div className="font-semibold text-sm">מילוי שאלונים</div>
                <div className="text-xs text-muted-foreground">
                  עוזר למאמנים להכיר אותך
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Has stats - show full detail view
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">הסטטיסטיקות שלי</h1>
        <p className="text-muted-foreground">
          צפייה בכל הנתונים והמדדים שלך
        </p>
      </div>

      <PlayerStatsDetail
        stats={playerStats}
        playerName={profile?.full_name || "שחקן"}
      />
    </div>
  );
}
