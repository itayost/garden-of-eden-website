"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PercentileRanking } from "../types";
import { getPercentileColor, getPercentileBgColor } from "../lib/utils";

interface PercentileCardProps {
  ranking: PercentileRanking;
  ageGroupLabel?: string;
}

export function PercentileCard({ ranking, ageGroupLabel }: PercentileCardProps) {
  const color = getPercentileColor(ranking.percentile);
  const bgColor = getPercentileBgColor(ranking.percentile);

  return (
    <Card className="py-3 gap-2 sm:py-6 sm:gap-6">
      <CardContent className="pt-2 pb-2 px-3 sm:pt-4 sm:pb-4 sm:px-6">
        <div className="flex items-start justify-between mb-1 sm:mb-2">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {ranking.metricLabelHe}
            </p>
            <p className="text-base sm:text-xl font-bold">
              {ranking.value} <span className="text-[10px] sm:text-xs font-normal">{ranking.unit}</span>
            </p>
          </div>
          <div className={cn("p-1 sm:p-1.5 rounded-full shrink-0", bgColor)}>
            <Trophy className={cn("h-3 w-3 sm:h-4 sm:w-4", color)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn(bgColor, color, "border-0")}>
            {ranking.percentileDisplay}
          </Badge>
          {ageGroupLabel && (
            <span className="text-xs text-muted-foreground">
              ב{ageGroupLabel}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
