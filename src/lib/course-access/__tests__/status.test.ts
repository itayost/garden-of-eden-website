import { describe, expect, it } from "vitest";
import { courseAccessStatusLines, type CourseAccessStatusInput } from "../status";

const today = "2026-12-01";
const show = (day: string) => `<${day}>`;
const base: CourseAccessStatusInput = {
  ruleOn: true,
  trainingNow: false,
  seenTrainingOn: null,
  accessUntil: null,
  today,
};

describe("courseAccessStatusLines", () => {
  it("says the rule is not on yet while the old rule holds", () => {
    expect(courseAccessStatusLines({ ...base, ruleOn: false }, show)).toEqual([
      "הכלל עוד לא פעיל: הגישה לפי הכלל הקודם",
    ]);
  });

  it("adds the mark's day on a second line while the old rule holds", () => {
    expect(courseAccessStatusLines({ ...base, ruleOn: false, accessUntil: "2026-12-20" }, show)).toEqual([
      "הכלל עוד לא פעיל: הגישה לפי הכלל הקודם",
      "מסומן פעיל עד <2026-12-20>",
    ]);
  });

  it("leaves out a mark that has passed while the old rule holds", () => {
    expect(courseAccessStatusLines({ ...base, ruleOn: false, accessUntil: "2026-11-30" }, show)).toEqual([
      "הכלל עוד לא פעיל: הגישה לפי הכלל הקודם",
    ]);
  });

  it("shows a mark ending today once the rule is on", () => {
    expect(
      courseAccessStatusLines({ ...base, trainingNow: true, seenTrainingOn: "2026-11-30", accessUntil: today }, show),
    ).toEqual(["מסומן פעיל עד <2026-12-01>"]);
  });

  it("shows the day he was seen training once the rule is on", () => {
    expect(courseAccessStatusLines({ ...base, trainingNow: true, seenTrainingOn: "2026-11-28" }, show)).toEqual([
      "פעיל: נראה מתאמן ב-<2026-11-28>",
    ]);
  });

  it("says not active once the rule is on and nothing holds", () => {
    expect(
      courseAccessStatusLines({ ...base, seenTrainingOn: "2026-10-01", accessUntil: "2026-11-30" }, show),
    ).toEqual(["לא פעיל: אין מנוי, כרטיסייה או מסלול פעילים"]);
  });
});
