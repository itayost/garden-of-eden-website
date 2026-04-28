"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { clearOwnNextGame } from "@/features/next-game/lib/actions/next-game";
import {
  daysUntilGame,
  formatHebrewGameDate,
  gameDayLabel,
} from "@/features/next-game/lib/format";

interface NextGameCardProps {
  game: {
    game_date: string;
    opponent: string;
  } | null;
}

export function NextGameCard({ game }: NextGameCardProps) {
  const router = useRouter();

  if (!game) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-5">
          <div className="flex items-center gap-4 flex-1">
            <div className="bg-amber-500 rounded-full p-2 shrink-0">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-semibold">המשחק הבא שלי</p>
              <p className="text-sm text-muted-foreground">כדי שנגיע לראות 👍</p>
            </div>
          </div>
          <Button asChild className="shrink-0 self-start sm:self-auto">
            <Link href="/dashboard/forms/next-game">הוספת משחק</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const dayLabel = gameDayLabel(daysUntilGame(game.game_date));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <div className="flex items-start gap-4">
          <div className="bg-amber-500 rounded-full p-2 shrink-0">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold">המשחק הבא שלי</h3>
              <Badge variant="secondary">{dayLabel}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatHebrewGameDate(game.game_date)} · נגד {game.opponent}
            </p>
            <p className="text-xs text-muted-foreground mt-1">כדי שנגיע לראות 👍</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/forms/next-game">
              <Pencil className="h-4 w-4 ml-1" />
              עריכה
            </Link>
          </Button>
          <DeleteConfirmDialog
            title="מחיקת המשחק הבא?"
            description="ניתן יהיה להוסיף משחק חדש בכל עת."
            confirmLabel="מחיקה"
            loadingLabel="מוחק..."
            successMessage="המשחק נמחק"
            errorMessage="שגיאה במחיקת המשחק"
            onDelete={async () => {
              const result = await clearOwnNextGame();
              if (result.success) return { success: true };
              return { error: result.error ?? "שגיאה במחיקת המשחק" };
            }}
            onSuccess={() => router.refresh()}
            trigger={
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 ml-1" />
                מחיקה
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
