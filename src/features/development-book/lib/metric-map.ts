/**
 * The metric-to-book map as the Admin editor shows it: one row per Goal
 * metric, its Development book parameters in the book's order, each with
 * what would keep its drills from a Trainee. Pure.
 */

import {
  GOAL_METRICS,
  isGoalMetric,
  METRIC_LABELS_HE,
  METRIC_UNITS,
  type GoalMetric,
} from "@/features/goals/lib/config/goal-config";

/** A parameter as the map editor lists it. */
export interface MapParameter {
  id: string;
  nameHe: string;
  categoryName: string;
  /** Category order, then parameter order: the book's own order. */
  order: number;
  isAllPositions: boolean;
  positions: string[];
  drillCount: number;
}

/** One stored pair of the map. */
export interface MapPair {
  parameterId: string;
  metricKey: string;
}

export interface MappedParameter extends MapParameter {
  warnings: string[];
}

export interface MetricMapRow {
  metricKey: GoalMetric;
  label: string;
  unit: string;
  parameters: MappedParameter[];
}

/** Not for every position and names none: `isParameterVisible` hides it from anyone with a position. */
export const HIDDEN_WARNING = "מוסתר מכל שחקן שיש לו עמדה";
export const NO_DRILLS_WARNING = "אין תרגילים";

/** Why a mapped parameter would offer no drill to some or all Trainees. */
export function parameterWarnings(parameter: MapParameter): string[] {
  return [
    !parameter.isAllPositions && parameter.positions.length === 0 ? HIDDEN_WARNING : null,
    parameter.drillCount === 0 ? NO_DRILLS_WARNING : null,
  ].filter((warning): warning is string => warning !== null);
}

/** The book's order; the name, then the id, break a tie so the list never jumps. */
export function byBookOrder(a: MapParameter, b: MapParameter): number {
  if (a.order !== b.order) return a.order - b.order;
  const byName = a.nameHe.localeCompare(b.nameHe, "he");
  if (byName !== 0) return byName;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * One row per GOAL_METRICS entry in that order. A pair whose parameter no
 * longer exists, or whose metric is not a Goal metric, is left out; a
 * repeated pair counts once.
 */
export function metricMapRows(parameters: readonly MapParameter[], pairs: readonly MapPair[]): MetricMapRow[] {
  const byId = new Map(parameters.map((parameter) => [parameter.id, parameter]));
  const known = pairs.filter((pair) => isGoalMetric(pair.metricKey));

  return GOAL_METRICS.map((metricKey) => {
    const ids = new Set(known.filter((pair) => pair.metricKey === metricKey).map((pair) => pair.parameterId));
    return {
      metricKey,
      label: METRIC_LABELS_HE[metricKey],
      unit: METRIC_UNITS[metricKey],
      parameters: [...ids]
        .flatMap((id) => {
          const parameter = byId.get(id);
          return parameter ? [parameter] : [];
        })
        .sort(byBookOrder)
        .map((parameter) => ({ ...parameter, warnings: parameterWarnings(parameter) })),
    };
  });
}
