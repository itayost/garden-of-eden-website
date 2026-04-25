import type { PlayerAssessment } from "@/types/assessment";
import type { AchievementBadgeType } from "../../types";

interface Input {
  /** Count of NON-DELETED assessments BEFORE this one. */
  priorAssessmentCount: number;
  /** The most recent prior assessment for the same user (chronologically), if any. */
  prevAssessment: PlayerAssessment | null;
  /** The just-recorded assessment. */
  newAssessment: PlayerAssessment;
  /** Overall rating from the previous snapshot (null if no prior snapshot or no data). */
  prevSnapshotOverall: number | null;
  /** Overall rating from the just-computed snapshot (null if not enough data). */
  newSnapshotOverall: number | null;
}

const SPRINT_KEYS = ["sprint_5m", "sprint_10m", "sprint_20m"] as const;
const JUMP_KEYS = [
  "jump_2leg_distance",
  "jump_right_leg",
  "jump_left_leg",
  "jump_2leg_height",
] as const;

function anyDecreased(
  prev: PlayerAssessment,
  next: PlayerAssessment,
  keys: readonly (keyof PlayerAssessment)[]
): boolean {
  return keys.some((k) => {
    const a = prev[k] as number | null;
    const b = next[k] as number | null;
    return a !== null && b !== null && b < a;
  });
}

function anyIncreased(
  prev: PlayerAssessment,
  next: PlayerAssessment,
  keys: readonly (keyof PlayerAssessment)[]
): boolean {
  return keys.some((k) => {
    const a = prev[k] as number | null;
    const b = next[k] as number | null;
    return a !== null && b !== null && b > a;
  });
}

/**
 * Pure: decide which assessment-derived badges this write earns.
 * Idempotency is guarded by the UNIQUE (user_id, badge_type) constraint at the DB layer.
 */
export function chooseAssessmentBadges(input: Input): AchievementBadgeType[] {
  const out: AchievementBadgeType[] = [];
  const total = input.priorAssessmentCount + 1;

  if (total === 1) out.push("first_assessment");
  if (total === 5) out.push("five_assessments");
  if (total === 10) out.push("ten_assessments");

  if (input.prevAssessment) {
    if (anyDecreased(input.prevAssessment, input.newAssessment, SPRINT_KEYS)) {
      out.push("sprint_improved");
    }
    if (anyIncreased(input.prevAssessment, input.newAssessment, JUMP_KEYS)) {
      out.push("jump_improved");
    }
  }

  if (input.prevSnapshotOverall !== null && input.newSnapshotOverall !== null) {
    const delta = input.newSnapshotOverall - input.prevSnapshotOverall;
    if (delta >= 5) out.push("overall_improved_5pts");
    if (delta >= 10) out.push("overall_improved_10pts");
  }

  return out;
}
