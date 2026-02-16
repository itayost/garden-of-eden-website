"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { UserStreak, UseStreakCelebrationReturn } from "../types";
import {
  findMilestoneReached,
  wasMilestoneCelebrated,
  markMilestoneCelebrated,
} from "../lib/utils/streak-utils";

/**
 * Hook to manage streak milestone celebrations
 * Shows toast when user reaches a milestone (7, 30, 100 days)
 * Uses localStorage to prevent duplicate celebrations
 */
export function useStreakCelebration(
  streak: UserStreak | null
): UseStreakCelebrationReturn {
  const [celebrated, setCelebrated] = useState(false);
  // Track which streak we've already processed to prevent duplicate checks
  const lastProcessedRef = useRef<string | null>(null);

  const checkAndCelebrate = useCallback(() => {
    if (!streak) return;

    const milestone = findMilestoneReached(streak.current_streak);
    if (!milestone) return;

    // Check if already celebrated this milestone
    if (wasMilestoneCelebrated(streak.user_id, milestone.value)) {
      return;
    }

    // Show celebration toast
    toast.success(`${milestone.emoji} ${milestone.label}`, {
      duration: milestone.duration,
      position: "top-center",
    });

    // Mark as celebrated
    markMilestoneCelebrated(streak.user_id, milestone.value);
    setCelebrated(true);
  }, [streak]);

  // Auto-check on mount and when streak changes
  // Use primitive values as dependencies to avoid infinite loops
  const userId = streak?.user_id;
  const currentStreak = streak?.current_streak;

  useEffect(() => {
    // Create a unique key for this streak state
    const processKey = `${userId}-${currentStreak}`;

    // Skip if we've already processed this exact streak state
    if (lastProcessedRef.current === processKey) {
      return;
    }

    lastProcessedRef.current = processKey;

    if (!streak) return;

    const milestone = findMilestoneReached(streak.current_streak);
    if (!milestone) return;

    if (wasMilestoneCelebrated(streak.user_id, milestone.value)) {
      return;
    }

    toast.success(`${milestone.emoji} ${milestone.label}`, {
      duration: milestone.duration,
      position: "top-center",
    });

    markMilestoneCelebrated(streak.user_id, milestone.value);
  }, [userId, currentStreak, streak]);

  return {
    checkAndCelebrate,
    celebrated,
  };
}
