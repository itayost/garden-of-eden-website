"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, ChevronDown, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubMetricRanking } from "../types";

interface CategoryMetricBreakdownProps {
  /** Hebrew label of the selected category (e.g. "ניתור"). */
  categoryLabel: string;
  breakdown: SubMetricRanking[];
}

function MetricValue({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="font-mono font-medium">
      {value.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
    </span>
  );
}

function SubMetricRow({ sub }: { sub: SubMetricRanking }) {
  const { leader, currentUserEntry, isPrimary } = sub;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium leading-tight">{sub.labelHe}</h4>
        {isPrimary && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            מדורג
          </Badge>
        )}
      </div>

      {leader ? (
        <div className="space-y-1.5 text-sm">
          {/* Group leader */}
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Crown className="h-3.5 w-3.5 text-yellow-500" />
              מוביל
            </span>
            <span className="flex items-center gap-2 min-w-0">
              <span className="truncate text-muted-foreground">{leader.userName}</span>
              <MetricValue value={leader.metricValue} unit={sub.unit} />
            </span>
          </div>

          {/* Current player's own standing */}
          {currentUserEntry && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-primary/5 px-2 py-1">
              <span className="text-primary font-medium">התוצאה שלך</span>
              <span className="flex items-center gap-2">
                <Badge
                  variant={currentUserEntry.percentile >= 75 ? "default" : "secondary"}
                  className="font-mono text-[10px]"
                >
                  #{currentUserEntry.rank}
                </Badge>
                <MetricValue value={currentUserEntry.metricValue} unit={sub.unit} />
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">אין נתונים</p>
      )}
    </div>
  );
}

export function CategoryMetricBreakdown({
  categoryLabel,
  breakdown,
}: CategoryMetricBreakdownProps) {
  const [isOpen, setIsOpen] = useState(true);

  // A single-metric category (e.g. זריזות) adds nothing beyond the main stats.
  if (breakdown.length <= 1) return null;

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          className="flex w-full items-center justify-between gap-2"
        >
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <ListTree className="h-5 w-5" />
            פירוט מבדקים - {categoryLabel}
          </CardTitle>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </CardHeader>
      {isOpen && (
        <CardContent className="px-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {breakdown.map((sub) => (
              <SubMetricRow key={sub.metric} sub={sub} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
