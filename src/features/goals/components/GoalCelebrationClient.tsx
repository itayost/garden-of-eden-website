"use client";

import type { PlayerGoalRow } from "@/types/database";
import { useGoalCelebration } from "../hooks/useGoalCelebration";

interface GoalCelebrationClientProps {
  goals: PlayerGoalRow[];
  userId: string;
}

/**
 * Client component that handles goal achievement celebrations
 * Wrap this around any page that displays goals to trigger celebrations
 */
export function GoalCelebrationClient({
  goals,
  userId,
}: GoalCelebrationClientProps) {
  // The hook handles celebration logic internally
  useGoalCelebration(goals, userId);

  // This component doesn't render anything visible
  // It only triggers celebration toasts through the hook
  return null;
}
