/**
 * The weekly_reports jsonb columns, written and read back. Pure.
 *
 * The Fact sheet, the Holds and the model's usage are interfaces, which the
 * generated `Json` type does not take as they are; toJson() copies a value the
 * way JSON.stringify would, so nothing is cast on the way in. On the way out a
 * column is checked before it is trusted: a row this code did not write, or
 * wrote under an older shape, reads as missing instead of half a sheet.
 */

import type { BodyFacts, FactSheet, HoldCode, HoldReason } from "../fact-sheet/types";
import type { Json } from "@/types/database";

/** The `fact_sheet` column: what the model saw, and what code shows beside it. */
export interface StoredSheet {
  sheet: FactSheet;
  body: BodyFacts | null;
}

const HOLD_CODES: readonly HoldCode[] = [
  "number",
  "drill",
  "length",
  "forbidden_word",
  "missing_gender",
  "writing_failed",
  "sensitive",
  "manual",
];

type JsonObject = { [key: string]: Json | undefined };

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** As JSON.stringify then JSON.parse: undefined fields drop, a non-finite number is null. */
export function toJson(value: unknown): Json {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((item) => (item === undefined ? null : toJson(item)));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, field]) => field !== undefined && typeof field !== "function")
        .map(([key, field]) => [key, toJson(field)]),
    );
  }
  return null;
}

function isHoldCode(value: unknown): value is HoldCode {
  return HOLD_CODES.some((code) => code === value);
}

/** The stored Holds, keeping only well-formed reasons, in order. */
export function holdReasonsOf(value: unknown): HoldReason[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): HoldReason[] =>
    isObject(item) && isHoldCode(item.code) && typeof item.text === "string"
      ? [{ code: item.code, text: item.text }]
      : [],
  );
}

const SHEET_ARRAYS = ["workedOn", "progress", "goals", "drills"] as const;

function isFactSheet(value: unknown): value is FactSheet {
  if (!isObject(value) || value.version !== 1) return false;
  const { week, player, attendance } = value;
  return (
    isObject(week) &&
    typeof week.from === "string" &&
    typeof week.to === "string" &&
    isObject(player) &&
    Array.isArray(player.branches) &&
    isObject(attendance) &&
    typeof attendance.total === "number" &&
    Array.isArray(attendance.days) &&
    SHEET_ARRAYS.every((key) => Array.isArray(value[key])) &&
    (value.habits === null || isObject(value.habits)) &&
    (value.assessment === null || isObject(value.assessment)) &&
    (value.nextGame === null || isObject(value.nextGame)) &&
    typeof value.hasNewMeasurement === "boolean" &&
    typeof value.hasDietitianNote === "boolean"
  );
}

function isBodyFacts(value: unknown): value is BodyFacts {
  return isObject(value) && typeof value.date === "string" && "dietitianNote" in value;
}

/** The stored `{ sheet, body }`, or null when the column holds anything else. */
export function storedSheetOf(value: unknown): StoredSheet | null {
  if (!isObject(value)) return null;
  const { sheet } = value;
  const body = value.body ?? null;
  if (!isFactSheet(sheet)) return null;
  if (body !== null && !isBodyFacts(body)) return null;
  return { sheet, body };
}

/**
 * The model's drill choice narrowed to the sheet's candidates, once each: the
 * column is a uuid list, and a made-up id is a Hold (the guardrails), never a
 * value to store.
 */
export function offeredDrillIds(sheet: FactSheet, chosen: readonly string[]): string[] {
  const offered = new Set(sheet.drills.map((drill) => drill.id));
  return [...new Set(chosen.filter((id) => offered.has(id)))];
}
