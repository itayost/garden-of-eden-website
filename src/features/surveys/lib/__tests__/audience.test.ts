import { expect, test } from "vitest";
import {
  type AudienceCandidate,
  birthYearCounts,
  birthYearOf,
  inSurveyAudience,
} from "../audience";

const kid = (over: Partial<AudienceCandidate> = {}): AudienceCandidate => ({
  profileId: "p1",
  fullName: "יונתן לוי",
  role: "trainee",
  isActive: true,
  deletedAt: null,
  birthdate: "2014-03-02",
  accessTier: "full",
  branchIds: ["b-ka"],
  ...over,
});

const KA = { branchIds: ["b-ka"], birthYears: [] as number[] };

test("an active full-access trainee of a target branch is in", () => {
  expect(inSurveyAudience(kid(), KA)).toBe(true);
});

test("other branch is out", () => {
  expect(inSurveyAudience(kid({ branchIds: ["b-haifa"] }), KA)).toBe(false);
});

test("one of two branches is enough", () => {
  expect(inSurveyAudience(kid({ branchIds: ["b-haifa", "b-ka"] }), KA)).toBe(true);
});

test("inactive, deleted, staff and course-only are out", () => {
  expect(inSurveyAudience(kid({ isActive: false }), KA)).toBe(false);
  expect(inSurveyAudience(kid({ deletedAt: "2026-01-01T00:00:00Z" }), KA)).toBe(false);
  expect(inSurveyAudience(kid({ role: "trainer" }), KA)).toBe(false);
  expect(inSurveyAudience(kid({ accessTier: "course_only" }), KA)).toBe(false);
});

test("birth years narrow by the year of the birthdate", () => {
  expect(inSurveyAudience(kid(), { ...KA, birthYears: [2014, 2015] })).toBe(true);
  expect(inSurveyAudience(kid(), { ...KA, birthYears: [2013] })).toBe(false);
});

test("no birthdate: in when no years are named, out when they are", () => {
  expect(inSurveyAudience(kid({ birthdate: null }), KA)).toBe(true);
  expect(inSurveyAudience(kid({ birthdate: null }), { ...KA, birthYears: [2014] })).toBe(false);
});

test("birthYearOf", () => {
  expect(birthYearOf("2014-12-31")).toBe(2014);
  expect(birthYearOf(null)).toBeNull();
});

test("birthYearCounts lists eligible years newest first", () => {
  const list = [
    kid(),
    kid({ profileId: "p2", birthdate: "2015-01-01" }),
    kid({ profileId: "p3" }),
    kid({ profileId: "p4", isActive: false, birthdate: "2016-01-01" }),
    kid({ profileId: "p5", birthdate: null }),
  ];
  expect(birthYearCounts(list, ["b-ka"])).toEqual([
    { year: 2015, count: 1 },
    { year: 2014, count: 2 },
  ]);
});
