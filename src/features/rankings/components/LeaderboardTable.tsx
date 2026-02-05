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

export function LeaderboardTable({
  leaderboard,
  category,
  currentUserId,
}: LeaderboardTableProps) {
  const config = RANKING_CATEGORIES[category];

  if (leaderboard.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            טבלת דירוג - {config.labelHe}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          טבלת דירוג - {config.labelHe}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Mobile: Card list */}
        <div className="space-y-2 sm:hidden">
          {leaderboard.map((entry) => {
            const isCurrentUser = entry.userId === currentUserId;
            const rankIcon = getRankIcon(entry.rank);

            return (
              <div
                key={entry.userId}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  isCurrentUser && "bg-primary/5 border-primary/20"
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
                      <Badge variant="outline" className="text-[10px] shrink-0">
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
                <TableHead className="text-center">תוצאה</TableHead>
                <TableHead className="text-center">אחוזון</TableHead>
                <TableHead className="text-center hidden md:table-cell">תאריך</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((entry) => {
                const isCurrentUser = entry.userId === currentUserId;
                const rankIcon = getRankIcon(entry.rank);

                return (
                  <TableRow
                    key={entry.userId}
                    className={cn(isCurrentUser && "bg-primary/5")}
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
                          <Badge variant="outline" className="text-xs">
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
