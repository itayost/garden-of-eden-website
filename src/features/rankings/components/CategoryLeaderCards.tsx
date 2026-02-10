"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Zap, ArrowUp, Shuffle, Move, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryLeader, RankingCategory } from "../types";
import { RANKING_CATEGORIES } from "../lib/config/categories";

interface CategoryLeaderCardsProps {
  leaders: CategoryLeader[];
  selectedCategory: RankingCategory;
  onCategorySelect: (category: RankingCategory) => void;
}

const CATEGORY_ICONS: Record<RankingCategory, typeof Zap> = {
  sprint: Zap,
  jump: ArrowUp,
  agility: Shuffle,
  flexibility: Move,
  power: Target,
};

const CATEGORY_COLORS: Record<RankingCategory, string> = {
  sprint: "from-yellow-500/20 to-orange-500/20",
  jump: "from-blue-500/20 to-cyan-500/20",
  agility: "from-purple-500/20 to-pink-500/20",
  flexibility: "from-green-500/20 to-emerald-500/20",
  power: "from-red-500/20 to-rose-500/20",
};

export function CategoryLeaderCards({
  leaders,
  selectedCategory,
  onCategorySelect,
}: CategoryLeaderCardsProps) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-5">
      {leaders.map((leader) => {
        const Icon = CATEGORY_ICONS[leader.category];
        const config = RANKING_CATEGORIES[leader.category];
        const isSelected = selectedCategory === leader.category;

        return (
          <Card
            key={leader.category}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              isSelected && "ring-2 ring-primary"
            )}
            onClick={() => onCategorySelect(leader.category)}
          >
            <CardHeader className={cn("pb-2 bg-gradient-to-br rounded-t-lg", CATEGORY_COLORS[leader.category])}>
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5" />
                {isSelected && (
                  <Badge variant="secondary" className="text-xs">
                    נבחר
                  </Badge>
                )}
              </div>
              <CardTitle className="text-sm">{config.labelHe}</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {leader.leader ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium text-sm truncate">
                      {leader.leader.userName}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(leader.leader.metricValue ?? 0).toFixed(2)}{" "}
                    {leader.category === "sprint" ? "שניות" : leader.category === "agility" ? "פגיעות" : leader.category === "power" ? "%" : "ס״מ"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {leader.totalPlayers} משתתפים
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-2">
                  אין נתונים
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
