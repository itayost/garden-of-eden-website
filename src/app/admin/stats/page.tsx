import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TrendingUp, Edit, Plus, Users } from "lucide-react";
import Link from "next/link";
import type { Profile, PlayerStats } from "@/types/database";

interface PlayerWithStats extends Profile {
  player_stats: PlayerStats[] | null;
}

export default async function AdminStatsPage() {
  const supabase = await createClient();

  // Fetch all trainee profiles with their stats
  // Use explicit foreign key since there are 2 relationships (user_id and last_updated_by)
  const { data: players } = (await supabase
    .from("profiles")
    .select(`
      *,
      player_stats!player_stats_user_id_fkey (*)
    `)
    .eq("role", "trainee")
    .order("full_name")) as unknown as { data: PlayerWithStats[] | null };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "טרם עודכן";
    return new Date(dateStr).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getRatingBadge = (rating: number | null | undefined) => {
    if (!rating) return <Badge variant="outline">ללא</Badge>;
    if (rating >= 80) return <Badge className="bg-green-500 hover:bg-green-600">{rating}</Badge>;
    if (rating >= 60) return <Badge className="bg-yellow-500 hover:bg-yellow-600">{rating}</Badge>;
    return <Badge className="bg-orange-500 hover:bg-orange-600">{rating}</Badge>;
  };

  const playersCount = players?.length || 0;
  const playersWithStats = players?.filter(p => p.player_stats && p.player_stats.length > 0).length || 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">ניהול סטטיסטיקות</h1>
          <p className="text-muted-foreground">
            עדכון וניהול סטטיסטיקות השחקנים
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה״כ מתאמנים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{playersCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">עם כרטיס שחקן</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{playersWithStats}</div>
            <p className="text-xs text-muted-foreground">
              {playersCount > 0 ? Math.round((playersWithStats / playersCount) * 100) : 0}% מהמתאמנים
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            רשימת שחקנים ({playersCount})
          </CardTitle>
          <CardDescription>לחצו על שחקן לעדכון הסטטיסטיקות שלו</CardDescription>
        </CardHeader>
        <CardContent>
          {players && players.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם</TableHead>
                    <TableHead>דירוג</TableHead>
                    <TableHead>עמדה</TableHead>
                    <TableHead>סוג כרטיס</TableHead>
                    <TableHead>עודכן</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((player) => {
                    const stats = player.player_stats?.[0];
                    return (
                      <TableRow key={player.id}>
                        <TableCell className="font-medium">
                          {player.full_name || "לא צוין"}
                        </TableCell>
                        <TableCell>
                          {getRatingBadge(stats?.overall_rating)}
                        </TableCell>
                        <TableCell>
                          {stats?.position || "-"}
                        </TableCell>
                        <TableCell>
                          {stats?.card_type ? (
                            <Badge variant="secondary">
                              {stats.card_type === "gold" ? "זהב" :
                               stats.card_type === "silver" ? "כסף" :
                               stats.card_type === "bronze" ? "ברונזה" :
                               stats.card_type === "special" ? "מיוחד" : stats.card_type}
                            </Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {formatDate(stats?.updated_at || null)}
                        </TableCell>
                        <TableCell>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/stats/${player.id}`}>
                              {stats ? (
                                <>
                                  <Edit className="h-4 w-4 ml-1" />
                                  עריכה
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 ml-1" />
                                  יצירה
                                </>
                              )}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>אין מתאמנים רשומים עדיין</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
