import { describe, expect, it } from "vitest";
import { MAX_START_AHEAD_DAYS, appliedStart, latestStartDate, startDateProblem } from "../start-date";

const TODAY = "2026-10-05";

describe("startDateProblem", () => {
  it("accepts no date, today, or a day up to 30 days ahead when the queue is empty", () => {
    expect(startDateProblem(null, TODAY, false)).toBeNull();
    expect(startDateProblem(TODAY, TODAY, false)).toBeNull();
    expect(startDateProblem("2026-11-04", TODAY, false)).toBeNull();
  });

  it("refuses a date in the past, for everyone", () => {
    expect(startDateProblem("2026-10-04", TODAY, false)).toBe("אי אפשר להתחיל מסלול בתאריך שעבר");
  });

  it("refuses more than 30 days ahead", () => {
    expect(startDateProblem("2026-11-05", TODAY, false)).toBe(`אפשר לקבוע התחלה עד ${MAX_START_AHEAD_DAYS} ימים קדימה`);
  });

  it("refuses a chosen date when a Plan is current or queued: the queue decides", () => {
    expect(startDateProblem("2026-10-10", TODAY, true)).toBe(
      "למתאמן יש מסלול פעיל או ממתין, והמסלול החדש יתחיל אחריו. אי אפשר לבחור תאריך התחלה.",
    );
    expect(startDateProblem(TODAY, TODAY, true)).toBeNull();
  });
});

describe("latestStartDate", () => {
  it("is 30 days from today", () => {
    expect(latestStartDate(TODAY)).toBe("2026-11-04");
  });
});

describe("appliedStart", () => {
  it("keeps a staff-chosen day for a training Plan only when the queue is empty", () => {
    expect(appliedStart("2026-10-20", TODAY, false, "subscription")).toBe("2026-10-20");
    expect(appliedStart("2026-10-20", TODAY, true, "subscription")).toBe(TODAY);
    expect(appliedStart(null, TODAY, false, "session_card")).toBe(TODAY);
  });

  it("keeps the chosen day for an Add-on, which sits outside the queue", () => {
    expect(appliedStart("2026-10-20", TODAY, true, "addon")).toBe("2026-10-20");
  });
});
