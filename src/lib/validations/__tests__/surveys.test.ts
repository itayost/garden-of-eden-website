import { describe, expect, test } from "vitest";
import type { SurveyDraft } from "@/features/surveys/lib/types";
import {
  surveyDetailsSchema,
  surveyDraftSchema,
  surveySubmitSchema,
} from "@/lib/validations/surveys";

const SURVEY_ID = "7c9e6679-7425-4f1d-8a4b-1c2d3e4f5a6b";
const BRANCH_A = "3f6c1a2e-7b4d-4e8a-9c1f-2a5b6c7d8e9f";
const BRANCH_B = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const QUESTION_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
const RATING_QUESTION_ID = "d4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f70";
const TEXT_QUESTION_ID = "e5f6a7b8-c9d0-4e1f-9a2b-3c4d5e6f7081";
const OPTION_ID = "c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f";

const validDraft: SurveyDraft = {
  title: "איך היה לך באקדמיה?",
  intro: "נשמח לשמוע מכם",
  opensOn: "2026-10-29",
  closesOn: "2026-11-05",
  birthYears: [2010, 2011],
  branchIds: [BRANCH_A, BRANCH_B],
  questions: [
    {
      kind: "single_choice",
      text: "כמה פעמים בשבוע?",
      required: true,
      lowLabel: null,
      highLabel: null,
      options: ["פעם אחת", "פעמיים"],
    },
  ],
};

describe("surveyDraftSchema", () => {
  test("a draft needs a 2 to 120 character title to be saved", () => {
    expect(surveyDraftSchema.safeParse({ ...validDraft, title: "א" }).success).toBe(false);
  });

  test("a draft may be saved with empty options while in progress", () => {
    const result = surveyDraftSchema.safeParse({
      ...validDraft,
      questions: [{ ...validDraft.questions[0], options: ["", ""] }],
    });
    expect(result.success).toBe(true);
  });

  test("a blank intro is stored as null", () => {
    const result = surveyDraftSchema.parse({ ...validDraft, intro: "   " });
    expect(result.intro).toBeNull();
  });

  test("a parsed draft has the SurveyDraft shape", () => {
    const parsed: SurveyDraft = surveyDraftSchema.parse(validDraft);
    expect(parsed).toEqual(validDraft);
  });

  test("a branch id that is not a uuid is refused", () => {
    expect(surveyDraftSchema.safeParse({ ...validDraft, branchIds: ["b-ka"] }).success).toBe(false);
  });

  test("a birth year outside 1990 to 2030 is refused", () => {
    expect(surveyDraftSchema.safeParse({ ...validDraft, birthYears: [1989] }).success).toBe(false);
  });
});

describe("surveyDetailsSchema", () => {
  test("accepts a title, an intro and a close date", () => {
    const result = surveyDetailsSchema.safeParse({
      title: validDraft.title,
      intro: validDraft.intro,
      closesOn: validDraft.closesOn,
    });
    expect(result.success).toBe(true);
  });

  test("refuses an intro over 500 characters", () => {
    const result = surveyDetailsSchema.safeParse({
      title: validDraft.title,
      intro: "א".repeat(501),
      closesOn: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("surveySubmitSchema", () => {
  test("submit refuses a non-uuid survey id", () => {
    expect(surveySubmitSchema.safeParse({ surveyId: "x", answers: [] }).success).toBe(false);
  });

  test("submit refuses a text answer over 1000 characters", () => {
    const result = surveySubmitSchema.safeParse({
      surveyId: SURVEY_ID,
      answers: [{ questionId: QUESTION_ID, text: "א".repeat(1001) }],
    });
    expect(result.success).toBe(false);
  });

  test("submit refuses a whitespace-only text answer", () => {
    const result = surveySubmitSchema.safeParse({
      surveyId: SURVEY_ID,
      answers: [{ questionId: QUESTION_ID, text: "   " }],
    });
    expect(result.success).toBe(false);
  });

  test("submit refuses a rating outside 1 to 5", () => {
    const result = surveySubmitSchema.safeParse({
      surveyId: SURVEY_ID,
      answers: [{ questionId: QUESTION_ID, rating: 6 }],
    });
    expect(result.success).toBe(false);
  });

  test("submit accepts a choice, a rating and a text answer", () => {
    const result = surveySubmitSchema.safeParse({
      surveyId: SURVEY_ID,
      answers: [
        { questionId: QUESTION_ID, optionIds: [OPTION_ID] },
        { questionId: RATING_QUESTION_ID, rating: 4 },
        { questionId: TEXT_QUESTION_ID, text: "תודה" },
      ],
    });
    expect(result.success).toBe(true);
  });
});
