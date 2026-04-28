import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUserNextGameForAdmin } from "@/lib/actions/admin-next-games-list";
import {
  daysUntilGame,
  formatHebrewGameDate,
  gameDayLabel,
} from "@/features/next-game/lib/format";

interface NextGameAdminCardProps {
  userId: string;
}

export async function NextGameAdminCard({ userId }: NextGameAdminCardProps) {
  const game = await getUserNextGameForAdmin(userId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          המשחק הבא
        </CardTitle>
      </CardHeader>
      <CardContent>
        {game ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {formatHebrewGameDate(game.game_date)}
              </span>
              <Badge variant="secondary">
                {gameDayLabel(daysUntilGame(game.game_date))}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">נגד {game.opponent}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">לא הוצהר משחק קרוב</p>
        )}
      </CardContent>
    </Card>
  );
}
