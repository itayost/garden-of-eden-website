import type { Metadata } from "next";
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
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { getUpcomingGames } from "@/lib/actions/admin-next-games-list";
import {
  daysUntilGame,
  formatHebrewGameDate,
  gameDayLabel,
} from "@/features/next-game/lib/format";

export const metadata: Metadata = {
  title: "המשחקים הקרובים | Garden of Eden",
};

export default async function AdminUpcomingGamesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: { role: string } | null };

  if (profile?.role !== "admin" && profile?.role !== "trainer") {
    redirect("/dashboard");
  }

  const games = await getUpcomingGames();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">המשחקים הקרובים</h1>
        <p className="text-muted-foreground">
          משחקים שהשחקנים הצהירו עליהם — כדי שנדע לאן ללכת לראות
        </p>
      </div>

      {games.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">אין משחקים קרובים</p>
            <p className="text-sm text-muted-foreground">
              שחקנים יופיעו כאן ברגע שיצהירו על משחק
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {games.map((g) => (
            <Link
              key={g.id}
              href={`/admin/users/${g.user_id}`}
              className="block group"
            >
              <Card className="transition-shadow group-hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">
                        {g.full_name || "שחקן ללא שם"}
                      </CardTitle>
                      <CardDescription>נגד {g.opponent}</CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {gameDayLabel(daysUntilGame(g.game_date))}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {formatHebrewGameDate(g.game_date, true)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
