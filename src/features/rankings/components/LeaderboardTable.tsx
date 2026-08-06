"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { ASSESSMENT_LABELS_HE, ASSESSMENT_UNITS } from "@/types/assessment";
import type { RankingEntry, RankingCategory } from "../types";
import { RANKING_CATEGORIES } from "../lib/config/categories";

interface LeaderboardTableProps {
  leaderboard: RankingEntry[];
  category: RankingCategory;
  currentUserId?: string;
}

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Trophy className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return null;
  }
}

function getRankBadgeVariant(rank: number): "default" | "secondary" | "outline" {
  if (rank === 1) return "default";
  if (rank <= 3) return "secondary";
  return "outline";
}

/**
 * The top-3 podium — first place centered, raised, gold and glowing; silver
 * and bronze flanking. A leaderboard for kids deserves a podium, not an icon
 * swap in a table row.
 */
function Podium({
  entries,
  currentUserId,
}: {
  entries: RankingEntry[];
  currentUserId?: string;
}) {
  // POSITIONAL, not rank-keyed: competition ranking produces ties (1,2,2,4),
  // so requiring exact ranks 1/2/3 would drop tied players from the page
  // entirely. The first three entries stand on the podium and each base shows
  // the entry's real rank, ties included.
  const [first, second, third] = entries;
  if (!first || !second || !third) return null;

  const column = (
    entry: RankingEntry,
    styles: { disc: string; base: string; height: string; discSize: string },
  ) => {
    const isCurrentUser = entry.userId === currentUserId;
    return (
      <div className="flex max-w-[110px] flex-1 flex-col items-center gap-1.5">
        <p className="w-full truncate text-center text-xs font-bold">
          {entry.userName}
        </p>
        {isCurrentUser && (
          <Badge className="bg-forest text-cream hover:bg-forest">אתה</Badge>
        )}
        <span
          className={cn(
            "grid place-items-center rounded-full font-display text-white",
            styles.disc,
            styles.discSize,
          )}
        >
          {entry.userName.slice(0, 1)}
        </span>
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          {entry.metricValue.toFixed(2)}
        </p>
        <div
          className={cn(
            "grid w-full place-items-center rounded-t-xl font-display text-2xl text-white",
            styles.base,
            styles.height,
          )}
        >
          {entry.rank}
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-end justify-center gap-2 border-b pb-0 sm:gap-4">
      {column(second, {
        disc: "bg-slate-400",
        base: "bg-slate-400",
        height: "h-16",
        discSize: "h-12 w-12 text-lg",
      })}
      {column(first, {
        disc: "bg-gradient-to-b from-gold-light to-gold shadow-[0_0_22px_rgba(245,158,11,0.5)]",
        base: "bg-gradient-to-b from-gold to-amber-700",
        height: "h-24",
        discSize: "h-16 w-16 text-2xl",
      })}
      {column(third, {
        disc: "bg-amber-700",
        base: "bg-amber-700",
        height: "h-12",
        discSize: "h-12 w-12 text-lg",
      })}
    </div>
  );
}

export function LeaderboardTable({
  leaderboard,
  category,
  currentUserId,
}: LeaderboardTableProps) {
  const config = RANKING_CATEGORIES[category];
  const metricLabel = ASSESSMENT_LABELS_HE[config.primaryMetric] ?? config.labelHe;
  const unit = ASSESSMENT_UNITS[config.primaryMetric] ?? "";

  if (leaderboard.length === 0) {
    return (
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            טבלת דירוג - {config.labelHe}
          </CardTitle>
          <p className="text-xs text-muted-foreground ps-7">{metricLabel}</p>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 py-8 text-center text-muted-foreground">
          אין נתונים להצגה
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "short",
    });
  };

  // Positional split matching the Podium: the first three ENTRIES go on the
  // podium, everyone else in the list — no entry can fall through on a tie.
  const hasPodium = leaderboard.length >= 3;
  const listEntries = hasPodium ? leaderboard.slice(3) : leaderboard;

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          טבלת דירוג - {config.labelHe}
        </CardTitle>
        <p className="text-xs text-muted-foreground ps-7">{metricLabel}</p>
      </CardHeader>
      <CardContent className="space-y-4 px-3 sm:px-6">
        {/* Podium for the top 3; the lists below start at rank 4. Falls back
            to plain rows when there are fewer than 3 ranked players. */}
        {hasPodium && (
          <Podium entries={leaderboard} currentUserId={currentUserId} />
        )}

        {/* Mobile: Card list */}
        <div className="space-y-2 sm:hidden">
          {listEntries.map((entry) => {
            const isCurrentUser = entry.userId === currentUserId;
            const rankIcon = getRankIcon(entry.rank);

            return (
              <div
                key={entry.userId}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  isCurrentUser && "border-2 border-forest bg-forest/5"
                )}
              >
                {/* Rank */}
                <div className="flex items-center gap-1.5 w-10 shrink-0">
                  {rankIcon || (
                    <Badge variant={getRankBadgeVariant(entry.rank)}>
                      {entry.rank}
                    </Badge>
                  )}
                  {rankIcon && (
                    <span className="font-bold text-sm">{entry.rank}</span>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("font-medium text-sm truncate", isCurrentUser && "text-primary")}>
                      {entry.userName}
                    </span>
                    {isCurrentUser && (
                      <Badge className="shrink-0 bg-forest text-[10px] text-cream hover:bg-forest">
                        אתה
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Score + Percentile */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm">{entry.metricValue.toFixed(2)}</span>
                  <Badge
                    variant={entry.percentile >= 75 ? "default" : "secondary"}
                    className="font-mono text-xs"
                  >
                    {entry.percentile}%
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: Table */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px] text-right">דירוג</TableHead>
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-center">תוצאה{unit ? ` (${unit})` : ""}</TableHead>
                <TableHead className="text-center">אחוזון</TableHead>
                <TableHead className="text-center hidden md:table-cell">תאריך</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listEntries.map((entry) => {
                const isCurrentUser = entry.userId === currentUserId;
                const rankIcon = getRankIcon(entry.rank);

                return (
                  <TableRow
                    key={entry.userId}
                    className={cn(isCurrentUser && "bg-forest/5")}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {rankIcon || (
                          <Badge variant={getRankBadgeVariant(entry.rank)}>
                            {entry.rank}
                          </Badge>
                        )}
                        {rankIcon && (
                          <span className="font-bold">{entry.rank}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={cn("font-medium", isCurrentUser && "text-primary")}>
                          {entry.userName}
                        </span>
                        {isCurrentUser && (
                          <Badge className="bg-forest text-xs text-cream hover:bg-forest">
                            אתה
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {entry.metricValue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={entry.percentile >= 75 ? "default" : "secondary"}
                        className="font-mono"
                      >
                        {entry.percentile}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground hidden md:table-cell">
                      {formatDate(entry.assessmentDate)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
