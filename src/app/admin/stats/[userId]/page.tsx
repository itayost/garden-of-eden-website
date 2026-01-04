import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayerStatsForm } from "@/components/admin/PlayerStatsForm";
import { PlayerCard } from "@/components/player-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, User } from "lucide-react";
import Link from "next/link";
import type { Profile, PlayerStats } from "@/types/database";
import type { PlayerPosition, CardType } from "@/types/player-stats";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function EditPlayerStatsPage({ params }: PageProps) {
  const { userId } = await params;
  const supabase = await createClient();

  // Fetch player profile
  const { data: player } = (await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()) as unknown as { data: Profile | null };

  if (!player) {
    notFound();
  }

  // Fetch existing stats (if any)
  const { data: existingStats } = (await supabase
    .from("player_stats")
    .select("*")
    .eq("user_id", userId)
    .single()) as unknown as { data: PlayerStats | null };

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <Link
          href="/admin/stats"
          className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה לרשימת השחקנים
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">
          {existingStats ? "עריכת" : "יצירת"} סטטיסטיקות
        </h1>
        <p className="text-muted-foreground flex items-center gap-2">
          <User className="h-4 w-4" />
          {player.full_name || "שחקן"}
        </p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-8">
        {/* Preview Card */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">תצוגה מקדימה</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              {existingStats ? (
                <PlayerCard
                  playerName={player.full_name || "שחקן"}
                  position={existingStats.position as PlayerPosition}
                  cardType={existingStats.card_type as CardType}
                  overallRating={existingStats.overall_rating}
                  stats={{
                    pace: existingStats.pace,
                    shooting: existingStats.shooting,
                    passing: existingStats.passing,
                    dribbling: existingStats.dribbling,
                    defending: existingStats.defending,
                    physical: existingStats.physical,
                  }}
                  avatarUrl={existingStats.avatar_url || undefined}
                  linkToStats={false}
                />
              ) : (
                <div className="w-[200px] h-[280px] rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">הכרטיס יופיע כאן</p>
                    <p className="text-xs">לאחר שמירה</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {existingStats && (
            <Card>
              <CardContent className="pt-4 text-sm text-muted-foreground space-y-1">
                <p>
                  נוצר:{" "}
                  {new Date(existingStats.created_at).toLocaleDateString("he-IL")}
                </p>
                <p>
                  עודכן:{" "}
                  {new Date(existingStats.updated_at).toLocaleDateString("he-IL")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Edit Form */}
        <div>
          <PlayerStatsForm
            userId={userId}
            playerName={player.full_name || "שחקן"}
            existingStats={existingStats}
          />
        </div>
      </div>
    </div>
  );
}
