import { Flame } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UserStreak } from "../types";

interface StreakCardProps {
  streak: UserStreak | null;
}

/**
 * The kid's streak — a pride card, so a live streak burns: fire gradient with
 * a warm glow. At zero it goes quiet and invites the first day.
 */
export function StreakCard({ streak }: StreakCardProps) {
  const currentStreak = streak?.current_streak || 0;
  const longestStreak = streak?.longest_streak || 0;
  const isBurning = currentStreak > 0;

  return (
    <Card
      className={cn(
        "h-full rounded-2xl border-0 py-0",
        isBurning
          ? "bg-gradient-to-bl from-orange-900 via-orange-700 to-orange-500 text-white shadow-[0_0_18px_rgba(234,88,12,0.35)]"
          : "border border-dashed bg-muted/30",
      )}
    >
      <CardContent className="flex h-full flex-col justify-between gap-2 px-4 py-3.5">
        <p
          className={cn(
            "flex items-center gap-1 text-xs font-semibold",
            isBurning ? "text-orange-100" : "text-muted-foreground",
          )}
        >
          <Flame className={cn("h-4 w-4", isBurning ? "text-yellow-300" : "")} />
          רצף אימונים
        </p>
        {isBurning ? (
          <>
            <p className="font-display text-4xl leading-none">
              {currentStreak} <span className="text-2xl">🔥</span>
            </p>
            <p className="text-xs text-orange-100/90">
              ימים ברצף{longestStreak > 0 ? ` · שיא ${longestStreak}` : ""}
            </p>
          </>
        ) : (
          <>
            <p className="text-3xl font-extrabold text-muted-foreground">0</p>
            {/* Keep the personal record in sight after a streak breaks — the
                number the kid is chasing shouldn't vanish with the streak. */}
            <p className="text-xs text-muted-foreground">
              התחל רצף היום
              {longestStreak > 0 ? ` · שיא אישי ${longestStreak} ימים` : ""}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
