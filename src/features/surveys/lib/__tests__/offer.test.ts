import { describe, expect, test } from "vitest";
import {
  durationLabel,
  isSnoozed,
  pickSurveyToOffer,
  snoozeKey,
  surveyPromptAllowedOn,
} from "../offer";

const a = { id: "a", closesOn: null, publishedAt: "2026-10-01T00:00:00Z" };
const b = { id: "b", closesOn: "2026-11-10", publishedAt: "2026-10-20T00:00:00Z" };
const c = { id: "c", closesOn: "2026-11-05", publishedAt: "2026-10-25T00:00:00Z" };
const d = { id: "d", closesOn: "2026-11-05", publishedAt: "2026-10-21T00:00:00Z" };

describe("pickSurveyToOffer", () => {
  test("earliest close date first, no close date last, then earliest published", () => {
    expect(pickSurveyToOffer([a, b, c, d])?.id).toBe("d");
  });

  test("a survey with no close date is still offered when it is the only one", () => {
    expect(pickSurveyToOffer([a])?.id).toBe("a");
  });

  test("no surveys offers nothing", () => {
    expect(pickSurveyToOffer([])).toBeNull();
  });

  test("a close date beats an earlier publish", () => {
    expect(pickSurveyToOffer([a, b])?.id).toBe("b");
  });

  test("does not reorder or mutate the input", () => {
    const input = [a, b, c, d];
    const before = input.map((s) => s.id);
    pickSurveyToOffer(input);
    expect(input.map((s) => s.id)).toEqual(before);
  });
});

describe("surveyPromptAllowedOn", () => {
  test("not while mid-activity", () => {
    const paths = [
      "/dashboard/workout",
      "/dashboard/workout/session-3",
      "/dashboard/scan/EQ-12",
      "/dashboard/forms/post-workout",
      "/dashboard/course/ch-1/lesson-2",
      "/dashboard/tactical-course/ch/l",
    ];
    for (const path of paths) {
      expect(surveyPromptAllowedOn(path)).toBe(false);
    }
  });

  test("a trailing slash makes no difference to the mid-activity check", () => {
    expect(surveyPromptAllowedOn("/dashboard/workout/")).toBe(false);
    expect(surveyPromptAllowedOn("/dashboard/forms/post-workout/")).toBe(false);
    expect(surveyPromptAllowedOn("/dashboard/course/ch-1/lesson-2/")).toBe(false);
  });

  test("everywhere else, including the forms index and course chapters list", () => {
    const paths = [
      "/dashboard",
      "/dashboard/schedule",
      "/dashboard/forms",
      "/dashboard/course",
      "/dashboard/course/ch-1",
      "/dashboard/profile",
    ];
    for (const path of paths) {
      expect(surveyPromptAllowedOn(path)).toBe(true);
    }
  });

  test("the forms index allows a trailing slash too", () => {
    expect(surveyPromptAllowedOn("/dashboard/forms/")).toBe(true);
  });

  test("matches whole path segments, not prefixes", () => {
    expect(surveyPromptAllowedOn("/dashboard/workouts")).toBe(true);
  });
});

describe("snooze", () => {
  test("snoozed only for the day it was snoozed", () => {
    expect(isSnoozed("2026-10-29", "2026-10-29")).toBe(true);
    expect(isSnoozed("2026-10-28", "2026-10-29")).toBe(false);
    expect(isSnoozed(null, "2026-10-29")).toBe(false);
  });

  test("the key is the prefix and the survey id", () => {
    expect(snoozeKey("abc")).toBe("goe_survey_snooze_abc");
  });
});

describe("durationLabel", () => {
  test("one minute for a single question and for five questions", () => {
    expect(durationLabel(1)).toBe("דקה אחת");
    expect(durationLabel(5)).toBe("דקה אחת");
  });

  test("minutes for longer surveys, at four questions a minute", () => {
    expect(durationLabel(12)).toBe("3 דקות");
    expect(durationLabel(20)).toBe("5 דקות");
  });
});
