import type { StreakMilestone } from "../../types";
import { STREAK_MILESTONES, CELEBRATION_STORAGE_KEY } from "../config/milestones";

/**
 * Find the highest milestone that was just reached
 * Only returns a milestone if current streak exactly matches it
 */
export function findMilestoneReached(currentStreak: number): StreakMilestone | null {
  return STREAK_MILESTONES.find((m) => m.value === currentStreak) || null;
}

/**
 * Safely parse and validate celebrated milestones from localStorage
 * Returns empty array if data is invalid or corrupted
 */
function parseCelebratedMilestones(data: string | null): number[] {
  if (!data) return [];

  try {
    const parsed = JSON.parse(data);

    // Validate it's an array
    if (!Array.isArray(parsed)) {
      return [];
    }

    // Filter to only valid numbers (milestone values)
    return parsed.filter(
      (item): item is number =>
        typeof item === "number" && Number.isFinite(item) && item > 0
    );
  } catch {
    return [];
  }
}

/**
 * Check if a milestone has already been celebrated (localStorage)
 */
export function wasMilestoneCelebrated(userId: string, milestone: number): boolean {
  if (typeof window === "undefined") return true;

  try {
    const key = `${CELEBRATION_STORAGE_KEY}_${userId}`;
    const celebrated = localStorage.getItem(key);
    const celebratedMilestones = parseCelebratedMilestones(celebrated);
    return celebratedMilestones.includes(milestone);
  } catch {
    return false;
  }
}

/**
 * Mark a milestone as celebrated (localStorage)
 */
export function markMilestoneCelebrated(userId: string, milestone: number): void {
  if (typeof window === "undefined") return;

  try {
    const key = `${CELEBRATION_STORAGE_KEY}_${userId}`;
    const celebrated = localStorage.getItem(key);
    const celebratedMilestones = parseCelebratedMilestones(celebrated);

    if (!celebratedMilestones.includes(milestone)) {
      celebratedMilestones.push(milestone);
      localStorage.setItem(key, JSON.stringify(celebratedMilestones));
    }
  } catch {
    // Silently fail - localStorage might be unavailable
  }
}

/**
 * Format streak for display
 */
export function formatStreakDisplay(streak: number): string {
  if (streak === 0) return "0";
  if (streak === 1) return "יום 1";
  return `${streak} ימים`;
}
