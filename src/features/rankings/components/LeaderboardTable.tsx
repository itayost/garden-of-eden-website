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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px] text-right">דירוג</TableHead>
              <TableHead className="text-right">שם</TableHead>
              <TableHead className="text-center">תוצאה</TableHead>
              <TableHead className="text-center">אחוזון</TableHead>
              <TableHead className="text-center hidden sm:table-cell">תאריך</TableHead>
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
                  <TableCell className="text-center text-muted-foreground hidden sm:table-cell">
                    {formatDate(entry.assessmentDate)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
