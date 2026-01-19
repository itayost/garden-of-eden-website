"use client";

import { Target, CheckCircle, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoalCardProps } from "../types";

/**
 * Displays a single goal with progress indicator
 */
export function GoalCard({ goal, compact = false }: GoalCardProps) {
  const isLowerBetter = goal.is_lower_better;

  const statusConfig = {
    achieved: {
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      label: "הושג!",
    },
    in_progress: {
      icon: isLowerBetter ? TrendingDown : TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      label: "בתהליך",
    },
    not_started: {
      icon: Target,
      color: "text-gray-500",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
      label: "טרם התחיל",
    },
  };

  const config = statusConfig[goal.status];
  const StatusIcon = config.icon;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center justify-between rounded-lg border p-3",
          config.bgColor,
          config.borderColor
        )}
      >
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("h-4 w-4", config.color)} />
          <span className="text-sm font-medium">{goal.metric_label_he}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            {goal.progress_text}
          </div>
          {goal.status !== "not_started" && (
            <div
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                goal.status === "achieved"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
              )}
            >
              {goal.progress_percentage}%
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        config.bgColor,
        config.borderColor
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("h-5 w-5", config.color)} />
          <h4 className="font-medium">{goal.metric_label_he}</h4>
        </div>
        <span
          className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            goal.status === "achieved"
              ? "bg-green-100 text-green-700"
              : goal.status === "in_progress"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600"
          )}
        >
          {config.label}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">יעד:</span>
          <span className="font-medium">
            {goal.target_value} {goal.unit}
          </span>
        </div>

        {goal.current_value !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">נוכחי:</span>
            <span className="font-medium">
              {goal.current_value} {goal.unit}
            </span>
          </div>
        )}

        {goal.status !== "not_started" && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span>התקדמות</span>
              <span className="font-medium">{goal.progress_percentage}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  goal.status === "achieved" ? "bg-green-500" : "bg-blue-500"
                )}
                style={{ width: `${Math.min(100, goal.progress_percentage)}%` }}
              />
            </div>
          </div>
        )}

        {goal.achieved_at && (
          <div className="mt-2 text-xs text-green-600">
            הושג ב-
            {new Date(goal.achieved_at).toLocaleDateString("he-IL")}
            {goal.achieved_value && ` (${goal.achieved_value} ${goal.unit})`}
          </div>
        )}
      </div>
    </div>
  );
}
