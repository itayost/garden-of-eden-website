"use client";

import { useStreakCelebration } from "../hooks/useStreakCelebration";
import type { UserStreak } from "../types";

interface StreakCelebrationClientProps {
  streak: UserStreak | null;
}

/**
 * Client component that handles streak milestone celebrations
 * Renders nothing visually - only triggers toast celebrations
 */
export function StreakCelebrationClient({ streak }: StreakCelebrationClientProps) {
  useStreakCelebration(streak);
  return null;
}
