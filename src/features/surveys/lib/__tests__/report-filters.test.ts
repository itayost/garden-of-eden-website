import { expect, test } from "vitest";
import { isNarrowed, parseReportFilters } from "../report-filters";

const ALLOWED = ["b-ka"];

test("defaults", () => {
  expect(parseReportFilters({}, ALLOWED)).toEqual({
    branchId: null,
    birthYear: null,
    segment: "answered",
    search: "",
    page: 1,
  });
});

test("a branch outside what the viewer may see is dropped", () => {
  expect(parseReportFilters({ branch: "b-ha" }, ALLOWED).branchId).toBeNull();
});

test("valid values are kept", () => {
  expect(
    parseReportFilters(
      { branch: "b-ka", year: "2014", segment: "unseen", q: "  לוי ", page: "3" },
      ALLOWED,
    ),
  ).toEqual({ branchId: "b-ka", birthYear: 2014, segment: "unseen", search: "לוי", page: 3 });
});

test("junk falls back", () => {
  expect(
    parseReportFilters(
      { year: "20x4", segment: "all", page: "-2", q: "א".repeat(80) },
      ALLOWED,
    ),
  ).toEqual({
    branchId: null,
    birthYear: null,
    segment: "answered",
    search: "א".repeat(60),
    page: 1,
  });
});

test("a year outside 1990 to 2030 is dropped, the edges are kept", () => {
  expect(parseReportFilters({ year: "1989" }, ALLOWED).birthYear).toBeNull();
  expect(parseReportFilters({ year: "2031" }, ALLOWED).birthYear).toBeNull();
  expect(parseReportFilters({ year: "1990" }, ALLOWED).birthYear).toBe(1990);
  expect(parseReportFilters({ year: "2030" }, ALLOWED).birthYear).toBe(2030);
});

test("a page that is zero, fractional or not a number falls back to 1", () => {
  for (const page of ["0", "2.5", "abc", ""]) {
    expect(parseReportFilters({ page }, ALLOWED).page).toBe(1);
  }
});

test("the seen segment is accepted", () => {
  expect(parseReportFilters({ segment: "seen" }, ALLOWED).segment).toBe("seen");
});

test("a repeated parameter uses its first value", () => {
  const filters = parseReportFilters({ branch: ["b-ka", "b-ha"], year: ["2015", "2014"] }, ALLOWED);
  expect(filters.branchId).toBe("b-ka");
  expect(filters.birthYear).toBe(2015);
});

test("a branch or a birth year narrows the report; a search, a page or a segment does not", () => {
  const none = parseReportFilters({}, ALLOWED);
  expect(isNarrowed(none)).toBe(false);
  expect(isNarrowed(parseReportFilters({ q: "לוי", page: "2", segment: "seen" }, ALLOWED))).toBe(false);
  expect(isNarrowed(parseReportFilters({ branch: "b-ka" }, ALLOWED))).toBe(true);
  expect(isNarrowed(parseReportFilters({ year: "2014" }, ALLOWED))).toBe(true);
});
