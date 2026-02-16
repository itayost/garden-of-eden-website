"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { PlayerGoalRow } from "@/types/database";
import type { UseGoalCelebrationReturn } from "../types";
import {
  getGoalCelebrationMessage,
  wasGoalCelebrated,
  markGoalCelebrated,
} from "../lib/utils/goal-utils";

/**
 * Hook to manage goal achievement celebrations
 * Shows toast when a goal is achieved
 * Uses localStorage to prevent duplicate celebrations
 */
export function useGoalCelebration(
  goals: PlayerGoalRow[],
  userId: string | null
): UseGoalCelebrationReturn {
  const [celebratedGoals, setCelebratedGoals] = useState<string[]>([]);
  // Track which goals we've already processed to prevent duplicate checks
  const lastProcessedRef = useRef<string | null>(null);
  // Track timeout IDs for cleanup on unmount
  const timeoutIdsRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach(clearTimeout);
      timeoutIdsRef.current = [];
    };
  }, []);

  const checkAndCelebrate = useCallback(() => {
    if (!userId || !goals.length) return;

    // Find newly achieved goals that haven't been celebrated
    const achievedGoals = goals.filter(
      (goal) => goal.achieved_at !== null && !wasGoalCelebrated(userId, goal.id)
    );

    if (achievedGoals.length === 0) return;

    // Celebrate each achieved goal
    // Mark as celebrated FIRST to prevent race conditions
    achievedGoals.forEach((goal) => {
      markGoalCelebrated(userId, goal.id);
    });

    // Clear any pending timeouts before setting new ones
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current = [];

    // Then show toasts with staggered timing
    achievedGoals.forEach((goal, index) => {
      const celebration = getGoalCelebrationMessage(goal);

      // Stagger toasts slightly if multiple goals achieved
      const timeoutId = setTimeout(
        () => {
          toast.success(`${celebration.emoji} ${celebration.title}`, {
            description: celebration.message,
            duration: celebration.duration,
            position: "top-center",
          });
        },
        index * 1000 // 1 second delay between toasts
      );
      timeoutIdsRef.current.push(timeoutId);
    });

    setCelebratedGoals((prev) => [
      ...prev,
      ...achievedGoals.map((g) => g.id),
    ]);
  }, [goals, userId]);

  // Auto-check on mount and when goals change
  // Use primitive values as dependencies to avoid infinite loops
  const achievedGoalIds = goals
    .filter((g) => g.achieved_at !== null)
    .map((g) => g.id)
    .sort()
    .join(",");

  useEffect(() => {
    // Create a unique key for this goals state
    const processKey = `${userId}-${achievedGoalIds}`;

    // Skip if we've already processed this exact goals state
    if (lastProcessedRef.current === processKey) {
      return;
    }

    lastProcessedRef.current = processKey;

    if (!userId || !goals.length) return;

    const achievedGoals = goals.filter(
      (goal) => goal.achieved_at !== null && !wasGoalCelebrated(userId, goal.id)
    );

    if (achievedGoals.length === 0) return;

    achievedGoals.forEach((goal) => {
      markGoalCelebrated(userId, goal.id);
    });

    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current = [];

    achievedGoals.forEach((goal, index) => {
      const celebration = getGoalCelebrationMessage(goal);

      const timeoutId = setTimeout(
        () => {
          toast.success(`${celebration.emoji} ${celebration.title}`, {
            description: celebration.message,
            duration: celebration.duration,
            position: "top-center",
          });
        },
        index * 1000
      );
      timeoutIdsRef.current.push(timeoutId);
    });

  }, [userId, achievedGoalIds, goals]);

  return {
    checkAndCelebrate,
    celebratedGoals,
  };
}
