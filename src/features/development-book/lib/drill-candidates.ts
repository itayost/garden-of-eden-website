/**
 * Which Development book drills serve which Assessment metric, for one
 * Trainee. Pure.
 *
 * The metric-to-parameter map (`book_parameter_metrics`) names the parameters
 * that train a metric; a parameter's drills are offered when the Trainee's
 * position sees the parameter (`isParameterVisible`) and its age rows fit the
 * Trainee's book age group (`fitsAge`). The Weekly report's Fact sheet and the
 * Goal proposals both pick their drills here, so a drill the book hides from a
 * Trainee is never offered to them.
 */

import { isParameterVisible } from "./filtering";
import type { AgeGroup, CanonicalPosition } from "./types";

/** A parameter as the drill rules see it. `ageGroups` are its age rows' raw values ("U15+" included). */
export interface PoolParameter {
  id: string;
  nameHe: string;
  isAllPositions: boolean;
  positions: CanonicalPosition[];
  ageGroups: string[];
  /** Category order, then parameter order: the book's own order. */
  order: number;
  metricKeys: string[];
}

export interface PoolDrill {
  id: string;
  parameterId: string;
  name: string;
  why: string | null;
  order: number;
}

export interface DrillPool {
  parameters: PoolParameter[];
  drills: PoolDrill[];
}

export interface MetricDrill {
  id: string;
  name: string;
  why: string | null;
  metricKey: string;
  parameterName: string;
}

/** A drill as a reader shows it. The weekly report's `DrillCandidate` has the same shape. */
export interface DrillLine {
  id: string;
  name: string;
  why: string | null;
}

export type PositionFit = "position" | "all" | "none";

/** The age row labels the rules read: the four book groups and the stored "U15+". */
export const BOOK_AGE_LABELS = ["U10-12", "U13-14", "U15-16", "U17+", "U15+"] as const;

/** The groups the stored "U15+" row covers. */
const U15_PLUS_COVERS: readonly AgeGroup[] = ["U15-16", "U17+"];

/** The book's own label in front of a "למה" line, which readers would print twice. */
const WHY_LABEL = /^למה זה עובד:\s*/;

interface Who {
  ageGroup: AgeGroup | null;
  position: string | null;
}

/** The trimmed Hebrew name, else the trimmed English one, else null. */
export function drillName(nameHe: string | null, nameEn: string | null): string | null {
  return nameHe?.trim() || nameEn?.trim() || null;
}

/** The "למה" line, trimmed and without the book's leading label; null when nothing is left. */
export function drillWhy(whyHe: string | null): string | null {
  return whyHe?.trim().replace(WHY_LABEL, "").trim() || null;
}

function isKnownLabel(label: string): boolean {
  return (BOOK_AGE_LABELS as readonly string[]).includes(label);
}

/**
 * True when a parameter with these age rows is for a Trainee of `group`. No
 * group (no birthdate) fits every parameter. Only the known labels count:
 * with none of them (no rows, or labels the rules do not know, since the
 * column has no CHECK) the parameter is for every age.
 */
export function fitsAge(ageGroups: readonly string[], group: AgeGroup | null): boolean {
  if (group === null) return true;
  const known = ageGroups.filter(isKnownLabel);
  if (known.length === 0) return true;
  return known.includes(group) || (known.includes("U15+") && U15_PLUS_COVERS.includes(group));
}

/** The mapped parameters of a metric that fit the Trainee's age, in book order. */
function mappedParameters(pool: DrillPool, metricKey: string, ageGroup: AgeGroup | null): PoolParameter[] {
  return pool.parameters
    .filter((parameter) => parameter.metricKeys.includes(metricKey) && fitsAge(parameter.ageGroups, ageGroup))
    .sort((a, b) => a.order - b.order);
}

/**
 * The drills of the parameters mapped to the metric that the Trainee's
 * position sees and that fit their age, in parameter order then drill order,
 * each once.
 */
export function drillsForMetric(
  pool: DrillPool,
  metricKey: string,
  who: Who,
): (PoolDrill & { parameterName: string })[] {
  const drills = mappedParameters(pool, metricKey, who.ageGroup)
    .filter((parameter) => isParameterVisible(parameter, who.position))
    .flatMap((parameter) =>
      pool.drills
        .filter((drill) => drill.parameterId === parameter.id)
        .sort((a, b) => a.order - b.order)
        .map((drill) => ({ ...drill, parameterName: parameter.nameHe })),
    );
  return drills.filter((drill, index) => drills.findIndex((other) => other.id === drill.id) === index);
}

export interface DrillRequest {
  metrics: readonly string[];
  ageGroup: AgeGroup | null;
  position: string | null;
  /** Drills the Trainee marked done lately: never offered. */
  doneIds: ReadonlySet<string>;
  /** Per metric, drill ids to put first when they are still on offer. */
  preferred?: ReadonlyMap<string, readonly string[]>;
  limit: number;
}

/** A metric's drills, not done, with its preferred ones moved to the front. */
function metricList(pool: DrillPool, metricKey: string, request: DrillRequest): MetricDrill[] {
  const offered = drillsForMetric(pool, metricKey, request)
    .filter((drill) => !request.doneIds.has(drill.id))
    .map(({ id, name, why, parameterName }) => ({ id, name, why, metricKey, parameterName }));
  const preferred = request.preferred?.get(metricKey) ?? [];
  const first = preferred.flatMap((id) => offered.filter((drill) => drill.id === id));
  return [...first, ...offered.filter((drill) => !preferred.includes(drill.id))];
}

/** Each list without the drills an earlier list already holds. */
function withoutEarlier(lists: readonly MetricDrill[][]): MetricDrill[][] {
  return lists.map((list, index) => {
    const earlier = new Set(lists.slice(0, index).flatMap((other) => other.map((drill) => drill.id)));
    return list.filter((drill) => !earlier.has(drill.id));
  });
}

/** One item of each list in turn: the first of every list, then the second, and so on. */
function inTurn<T>(lists: readonly T[][]): T[] {
  const rounds = Math.max(0, ...lists.map((list) => list.length));
  return Array.from({ length: rounds }, (_, round) => lists.flatMap((list) => list.slice(round, round + 1))).flat();
}

/**
 * The drills to offer for these metrics: per metric in the given order its
 * drills not done lately (its preferred ones first), then one drill per metric
 * in turn until `limit`. A drill reached through two metrics appears once,
 * under the first of them.
 */
export function drillCandidatesFor(pool: DrillPool, request: DrillRequest): MetricDrill[] {
  const metrics = [...new Set(request.metrics)];
  const lists = withoutEarlier(metrics.map((metricKey) => metricList(pool, metricKey, request)));
  return inTurn(lists).slice(0, Math.max(0, request.limit));
}

/**
 * How a metric fits the Trainee's position, counting only the mapped
 * parameters that fit their age: "position" when one names the position,
 * "all" when one is visible to it (every position), else "none". The same
 * parameters give the drills, so the tier and the drills offered agree.
 */
export function metricPositionFit(pool: DrillPool, metricKey: string, who: Who): PositionFit {
  const parameters = mappedParameters(pool, metricKey, who.ageGroup);
  const position = who.position;
  if (position !== null && parameters.some((p) => !p.isAllPositions && p.positions.some((own) => own === position))) {
    return "position";
  }
  return parameters.some((parameter) => isParameterVisible(parameter, position)) ? "all" : "none";
}
