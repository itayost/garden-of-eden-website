/**
 * Reads the results page's URL parameters into ReportFilters. Pure: anything
 * the viewer could not have chosen from the page falls back to its default.
 */
import type { ReportFilters, ReportSegment } from "./report";

type SearchParams = Record<string, string | string[] | undefined>;

const SEGMENTS: readonly ReportSegment[] = ["answered", "seen", "unseen"];
const DEFAULT_SEGMENT: ReportSegment = "answered";
const MIN_BIRTH_YEAR = 1990;
const MAX_BIRTH_YEAR = 2030;
const MAX_SEARCH_LENGTH = 60;
/** Nine digits keeps the number a safe integer. */
const WHOLE_NUMBER = /^\d{1,9}$/;

/** A repeated parameter (?year=2014&year=2015) counts as its first value. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function wholeNumber(value: string | undefined): number | null {
  return value !== undefined && WHOLE_NUMBER.test(value) ? Number(value) : null;
}

function parseBirthYear(value: string | undefined): number | null {
  const year = wholeNumber(value);
  return year !== null && year >= MIN_BIRTH_YEAR && year <= MAX_BIRTH_YEAR ? year : null;
}

function parsePage(value: string | undefined): number {
  const page = wholeNumber(value);
  return page !== null && page >= 1 ? page : 1;
}

/** Trimmed and cut to 60 characters (whole characters, not halves of a pair). */
function parseSearch(value: string | undefined): string {
  const characters = Array.from((value ?? "").trim());
  return characters.slice(0, MAX_SEARCH_LENGTH).join("").trim();
}

/**
 * `allowedBranchIds` are the branches the viewer may filter by; a branch
 * outside them is dropped rather than trusted.
 */
export function parseReportFilters(
  params: SearchParams,
  allowedBranchIds: readonly string[],
): ReportFilters {
  const branch = firstValue(params.branch);
  const segment = firstValue(params.segment);
  return {
    branchId: branch !== undefined && allowedBranchIds.includes(branch) ? branch : null,
    birthYear: parseBirthYear(firstValue(params.year)),
    segment: SEGMENTS.find((s) => s === segment) ?? DEFAULT_SEGMENT,
    search: parseSearch(firstValue(params.q)),
    page: parsePage(firstValue(params.page)),
  };
}
