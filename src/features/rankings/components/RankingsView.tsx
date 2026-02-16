"use client";

import { useState, useTransition, useRef } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, RefreshCw } from "lucide-react";
import { AgeGroupFilter } from "./AgeGroupFilter";
import { CategoryLeaderCards } from "./CategoryLeaderCards";
import { LeaderboardTable } from "./LeaderboardTable";
import { GroupStatisticsCard } from "./GroupStatisticsCard";

const DistributionChart = dynamic(
  () => import("./DistributionChart").then((m) => m.DistributionChart),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    ),
  }
);
import type { RankingsData } from "../lib/actions/get-rankings";
import type { RankingCategory } from "../types";
import { getRankingsData } from "../lib/actions/get-rankings";

interface RankingsViewProps {
  initialData: RankingsData;
  currentUserId?: string;
  /** Is the current user a trainee (vs admin/trainer)? */
  isTrainee?: boolean;
  /** Trainee's own age group ID (for restricting view) */
  userAgeGroupId?: string | null;
  /** Trainee's own age group label in Hebrew */
  userAgeGroupLabel?: string | null;
}

export function RankingsView({
  initialData,
  currentUserId,
  isTrainee = false,
  userAgeGroupLabel,
}: RankingsViewProps) {
  const [data, setData] = useState<RankingsData>(initialData);
  const [isPending, startTransition] = useTransition();
  // Track request ID to ignore stale responses from concurrent requests
  const requestIdRef = useRef(0);

  const handleAgeGroupChange = (ageGroupId: string) => {
    // Trainees can only view their own age group
    if (isTrainee) return;

    const currentRequestId = ++requestIdRef.current;
    startTransition(async () => {
      const newData = await getRankingsData(ageGroupId, data.selectedCategory);
      // Only update if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setData(newData);
      }
    });
  };

  const handleCategorySelect = (category: RankingCategory) => {
    const currentRequestId = ++requestIdRef.current;
    startTransition(async () => {
      const newData = await getRankingsData(data.selectedAgeGroup, category);
      // Only update if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setData(newData);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            דירוג שחקנים
          </h1>
          <p className="text-muted-foreground mt-1">
            השוואת ביצועים בין שחקנים לפי קטגוריות
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isPending && (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {isTrainee ? (
            // Trainees see only their age group (no filter control)
            <Badge variant="secondary" className="text-sm">
              <Users className="h-3 w-3 ml-1" />
              {userAgeGroupLabel || "קבוצת הגיל שלי"}
            </Badge>
          ) : (
            // Admin/trainers can filter by age group
            <AgeGroupFilter
              selectedAgeGroup={data.selectedAgeGroup}
              availableAgeGroups={data.availableAgeGroups}
              onAgeGroupChange={handleAgeGroupChange}
            />
          )}
        </div>
      </div>

      {/* Summary Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-sm">
          <Users className="h-3 w-3 ml-1" />
          {data.totalPlayers} שחקנים
        </Badge>
        {data.currentUserRank && (
          <Badge variant="secondary" className="text-sm">
            המיקום שלך: #{data.currentUserRank.rank}
          </Badge>
        )}
      </div>

      {/* No Data State */}
      {data.totalPlayers === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Trophy className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium">אין נתונים עדיין</h3>
                <p className="text-muted-foreground">
                  הדירוג יתעדכן כאשר יהיו מבדקים בקבוצת הגיל שנבחרה
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Category Leader Cards */}
          <CategoryLeaderCards
            leaders={data.categoryLeaders}
            selectedCategory={data.selectedCategory}
            onCategorySelect={handleCategorySelect}
          />

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Leaderboard - Takes 2 columns */}
            <div className="lg:col-span-2">
              <LeaderboardTable
                leaderboard={data.leaderboard}
                category={data.selectedCategory}
                currentUserId={currentUserId}
              />
            </div>

            {/* Statistics - Takes 1 column */}
            <div className="space-y-6">
              <GroupStatisticsCard
                statistics={data.statistics}
                category={data.selectedCategory}
              />
              <DistributionChart
                distribution={data.distribution}
                category={data.selectedCategory}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
