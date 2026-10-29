import { describe, expect, test } from "vitest";
import { closeDateProblem, saveRefusal, withBlankClosesOn } from "../staff-input";
import { STAFF_MESSAGES } from "../staff-messages";
import type { SurveyDraft } from "../types";

describe("withBlankClosesOn", () => {
  test("an empty close date becomes null", () => {
    expect(withBlankClosesOn({ title: "סקר", closesOn: "" })).toEqual({ title: "סקר", closesOn: null });
  });

  test("a spaces-only close date becomes null", () => {
    expect(withBlankClosesOn({ closesOn: "   " })).toEqual({ closesOn: null });
  });

  test("a real date and null are left alone", () => {
    expect(withBlankClosesOn({ closesOn: "2026-11-05" })).toEqual({ closesOn: "2026-11-05" });
    expect(withBlankClosesOn({ closesOn: null })).toEqual({ closesOn: null });
  });

  test("the other fields are kept and the input is not changed", () => {
    const input = { title: "סקר", intro: "", closesOn: "" };
    const result = withBlankClosesOn(input);
    expect(result).toEqual({ title: "סקר", intro: "", closesOn: null });
    expect(input.closesOn).toBe("");
  });

  test("anything that is not an object passes through for the schema to refuse", () => {
    expect(withBlankClosesOn(null)).toBeNull();
    expect(withBlankClosesOn("x")).toBe("x");
  });
});

describe("closeDateProblem", () => {
  const today = "2026-10-29";

  test("no close date is fine", () => {
    expect(closeDateProblem("2026-10-01", null, today)).toBeNull();
  });

  test("today and later are fine for a survey that already opened", () => {
    expect(closeDateProblem("2026-10-01", "2026-10-29", today)).toBeNull();
    expect(closeDateProblem("2026-10-01", "2026-12-01", today)).toBeNull();
  });

  test("a day before today has passed", () => {
    expect(closeDateProblem("2026-10-01", "2026-10-28", today)).toBe("תאריך הסגירה כבר עבר");
  });

  test("a survey opening later closes on or after its opening day", () => {
    expect(closeDateProblem("2026-11-05", "2026-11-05", today)).toBeNull();
    expect(closeDateProblem("2026-11-05", "2026-11-04", today)).toBe("תאריך הסגירה לפני תאריך הפתיחה");
  });

  test("a date that is both before today and before the opening has passed", () => {
    expect(closeDateProblem("2026-11-05", "2026-10-20", today)).toBe("תאריך הסגירה כבר עבר");
  });
});

describe("saveRefusal", () => {
  const today = "2026-10-29";
  const draft: SurveyDraft = {
    title: "סקר סוף עונה",
    intro: null,
    opensOn: "2026-10-01",
    closesOn: null,
    birthYears: [],
    branchIds: ["b1"],
    questions: [{ kind: "text", text: "מה לשנות?", required: true, lowLabel: null, highLabel: null, options: [] }],
  };
  const stored = { publishedAt: null, closedAt: null, responseCount: 0 };
  const published = { ...stored, publishedAt: "2026-10-20T10:00:00Z" };

  test("a new draft passes", () => {
    expect(saveRefusal(draft, null, today)).toBeNull();
  });

  test("a new draft may be half finished, since saving is looser than publishing", () => {
    expect(saveRefusal({ ...draft, questions: [], branchIds: [] }, null, today)).toBeNull();
  });

  test("a close date before the open date is refused, for a new draft and a stored one", () => {
    const backwards = { ...draft, opensOn: "2026-11-05", closesOn: "2026-11-04" };
    expect(saveRefusal(backwards, null, today)).toBe(STAFF_MESSAGES.closeBeforeOpen);
    expect(saveRefusal(backwards, stored, today)).toBe(STAFF_MESSAGES.closeBeforeOpen);
  });

  test("closing on the open day, or never, passes", () => {
    expect(saveRefusal({ ...draft, closesOn: "2026-10-01" }, null, today)).toBeNull();
    expect(saveRefusal({ ...draft, closesOn: null }, null, today)).toBeNull();
  });

  test("an unpublished stored Survey with no Responses passes, even if it is not ready to publish", () => {
    expect(saveRefusal({ ...draft, questions: [] }, stored, today)).toBeNull();
  });

  test("a Survey with Responses is refused", () => {
    expect(saveRefusal(draft, { ...stored, responseCount: 3 }, today)).toBe(STAFF_MESSAGES.hasResponses);
  });

  test("a closed Survey is refused, whether or not it has Responses", () => {
    const closed = { ...published, closedAt: "2026-10-25T10:00:00Z" };
    expect(saveRefusal(draft, closed, today)).toBe("הסקר כבר נסגר");
    expect(saveRefusal(draft, { ...closed, responseCount: 2 }, today)).toBe("הסקר כבר נסגר");
  });

  test("a published Survey that stays publishable passes", () => {
    expect(saveRefusal(draft, published, today)).toBeNull();
  });

  test("a published Survey cannot lose its Questions", () => {
    expect(saveRefusal({ ...draft, questions: [] }, published, today)).toBe("צריך לפחות שאלה אחת");
  });

  test("a published Survey cannot carry a blank option", () => {
    const blank: SurveyDraft = {
      ...draft,
      questions: [{ kind: "single_choice", text: "כמה פעמים?", required: true, lowLabel: null, highLabel: null, options: ["פעם", " "] }],
    };
    expect(saveRefusal(blank, published, today)).toBe("שאלה 1: תשובה ריקה");
  });

  test("every publish problem is listed, joined with a dot", () => {
    const refusal = saveRefusal({ ...draft, branchIds: [], questions: [] }, published, today);
    expect(refusal).toBe("צריך לבחור לפחות סניף אחד · צריך לפחות שאלה אחת");
  });

  test("a published Survey with a backwards close date gets the one date message, not a list", () => {
    const backwards = { ...draft, opensOn: "2026-11-05", closesOn: "2026-11-04" };
    expect(saveRefusal(backwards, published, today)).toBe(STAFF_MESSAGES.closeBeforeOpen);
  });
});
