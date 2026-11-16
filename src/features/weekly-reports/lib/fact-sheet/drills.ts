/**
 * The Development book drills the Fact sheet offers for the Trainee's open
 * Goals. Pure.
 *
 * The open Goals oldest first, one drill per Goal in turn until 6, by the
 * book's own rules (`drillCandidatesFor`: the metric-to-parameter map, the
 * book age group, the position, no drill marked done lately). The drills of
 * the accepted Goal proposal behind a Goal come first for that Goal. A
 * Trainee with no open Goal gets no drills.
 */

import { deriveAgeGroup } from "@/features/development-book/lib/age-group";
import { drillCandidatesFor, type DrillPool } from "@/features/development-book/lib/drill-candidates";
import { METRIC_LABELS_HE } from "@/features/goals/lib/config/goal-config";
import type { PlayerGoalRow } from "@/types/database";
import type { SheetDrill } from "./types";

export const MAX_SHEET_DRILLS = 6;

export interface SheetDrillsInput {
  goals: readonly PlayerGoalRow[];
  birthdate: string | null;
  position: string | null;
  /** The Report week's Thursday: the age is taken on it. */
  weekEnd: string;
  /** Drills the Trainee marked done in the 30 days up to `weekEnd`. */
  doneIds: ReadonlySet<string>;
  /** Goal id to the drills of the accepted Goal proposal behind it. */
  goalDrills: ReadonlyMap<string, readonly string[]>;
}

/** The Goal's Hebrew label, the same text `goalFacts()` gives as `metric`. */
function goalLabel(metricKey: string): string {
  const labels: Readonly<Record<string, string | undefined>> = METRIC_LABELS_HE;
  return labels[metricKey] || metricKey;
}

/** Oldest first; the id breaks a tie, so a rebuilt sheet gets the same drills. */
function oldestFirst(a: PlayerGoalRow, b: PlayerGoalRow): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sheetDrills(pool: DrillPool, input: SheetDrillsInput): SheetDrill[] {
  const open = input.goals.filter((goal) => goal.achieved_at === null).sort(oldestFirst);
  if (open.length === 0) return [];
  const preferred = new Map(open.map((goal) => [goal.metric_key, input.goalDrills.get(goal.id) ?? []]));
  const drills = drillCandidatesFor(pool, {
    metrics: open.map((goal) => goal.metric_key),
    ageGroup: deriveAgeGroup(input.birthdate, new Date(`${input.weekEnd}T12:00:00Z`)),
    position: input.position,
    doneIds: input.doneIds,
    preferred,
    limit: MAX_SHEET_DRILLS,
  });
  return drills.map(({ id, name, why, metricKey }) => ({ id, name, why, goal: goalLabel(metricKey) }));
}
