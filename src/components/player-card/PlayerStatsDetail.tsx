"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerCard } from "./PlayerCard";
import {
  STAT_LABELS_HE,
  PILLAR_LABELS_HE,
  STAT_TO_PILLAR,
  STAT_CATEGORIES,
  TRAINING_METRICS,
  getStatColor,
  getStatBarColor,
  type TrainingPillar,
  type PlayerPosition,
  type CardType,
} from "@/types/player-stats";
import type { PlayerStats } from "@/types/database";
import { cn } from "@/lib/utils";
import { Activity, Brain, Target, Heart, Zap, Shield } from "lucide-react";

// Icons for each stat category
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  pace: <Zap className="h-5 w-5" />,
  shooting: <Target className="h-5 w-5" />,
  passing: <Activity className="h-5 w-5" />,
  dribbling: <Activity className="h-5 w-5" />,
  defending: <Shield className="h-5 w-5" />,
  physical: <Heart className="h-5 w-5" />,
};

interface StatBarProps {
  label: string;
  value: number;
  showPillar?: boolean;
  pillar?: TrainingPillar;
  delay?: number;
}

function StatBar({ label, value, showPillar, pillar, delay = 0 }: StatBarProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-sm text-muted-foreground truncate">{label}</div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: "easeOut", delay }}
          className={cn("h-full rounded-full", getStatBarColor(value))}
        />
      </div>
      <div className={cn("w-8 text-sm font-semibold text-left", getStatColor(value))}>
        {value}
      </div>
      {showPillar && pillar && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 hidden sm:inline-flex">
          {PILLAR_LABELS_HE[pillar]}
        </Badge>
      )}
    </div>
  );
}

interface StatCategoryProps {
  title: string;
  mainStat: number;
  subStats: { key: string; value: number }[];
  icon?: React.ReactNode;
  delay?: number;
}

function StatCategory({ title, mainStat, subStats, icon, delay = 0 }: StatCategoryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              {icon}
              <span>{title}</span>
            </div>
            <span className={cn("text-2xl font-bold", getStatColor(mainStat))}>
              {mainStat}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {subStats.map(({ key, value }, index) => (
            <StatBar
              key={key}
              label={STAT_LABELS_HE[key] || key}
              value={value}
              delay={delay + index * 0.05}
            />
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface PlayerStatsDetailProps {
  stats: PlayerStats;
  playerName: string;
}

export function PlayerStatsDetail({ stats, playerName }: PlayerStatsDetailProps) {
  // Build stat categories with their sub-stats
  const statCategoriesWithValues = STAT_CATEGORIES.map((category) => ({
    key: category.key,
    title: STAT_LABELS_HE[category.key],
    mainStat: stats[category.key as keyof PlayerStats] as number,
    subStats: category.subStats.map((subStat) => ({
      key: subStat,
      value: stats[subStat as keyof PlayerStats] as number,
    })),
    icon: CATEGORY_ICONS[category.key],
  }));

  // Training metrics
  const trainingMetricsWithValues = TRAINING_METRICS.map((metric) => ({
    key: metric,
    value: stats[metric as keyof PlayerStats] as number,
  }));

  return (
    <div className="grid lg:grid-cols-[auto_1fr] gap-8">
      {/* Left side - Player Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center lg:items-start gap-4"
      >
        <PlayerCard
          playerName={playerName}
          position={stats.position as PlayerPosition}
          cardType={stats.card_type as CardType}
          overallRating={stats.overall_rating}
          stats={{
            pace: stats.pace,
            shooting: stats.shooting,
            passing: stats.passing,
            dribbling: stats.dribbling,
            defending: stats.defending,
            physical: stats.physical,
          }}
          linkToStats={false}
          size="lg"
        />

        {/* Last updated info */}
        {stats.updated_at && (
          <p className="text-sm text-muted-foreground text-center lg:text-right">
            עודכן לאחרונה:{" "}
            {new Date(stats.updated_at).toLocaleDateString("he-IL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}

        {/* Overall stats summary */}
        <Card className="w-full max-w-[240px]">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">דירוג כולל</div>
              <div className={cn("text-4xl font-bold", getStatColor(stats.overall_rating))}>
                {stats.overall_rating}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Right side - Detailed Stats */}
      <div className="space-y-6">
        {/* Main stat categories - 2x3 grid */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {statCategoriesWithValues.map((category, index) => {
            const { key, ...categoryProps } = category;
            return (
              <StatCategory
                key={key}
                {...categoryProps}
                delay={index * 0.1}
              />
            );
          })}
        </div>

        {/* Training-specific metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                מדדי אימון נוספים
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {trainingMetricsWithValues.map(({ key, value }, index) => (
                <StatBar
                  key={key}
                  label={STAT_LABELS_HE[key] || key}
                  value={value}
                  showPillar
                  pillar={STAT_TO_PILLAR[key]}
                  delay={0.7 + index * 0.05}
                />
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Notes section if available */}
        {stats.notes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>הערות המאמן</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{stats.notes}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
