import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame } from "lucide-react";
import type { UserStreak } from "../types";

interface StreakCardProps {
  streak: UserStreak | null;
}

/**
 * Card component displaying current streak and personal record
 */
export function StreakCard({ streak }: StreakCardProps) {
  const currentStreak = streak?.current_streak || 0;
  const longestStreak = streak?.longest_streak || 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-1">
          <Flame className="h-4 w-4 text-orange-500" />
          רצף אימונים
        </CardDescription>
        <CardTitle className="text-3xl">
          {currentStreak} {currentStreak > 0 && "🔥"}
        </CardTitle>
      </CardHeader>
      {longestStreak > 0 && (
        <CardContent>
          <p className="text-xs text-muted-foreground">
            שיא אישי: {longestStreak} ימים
          </p>
        </CardContent>
      )}
    </Card>
  );
}
