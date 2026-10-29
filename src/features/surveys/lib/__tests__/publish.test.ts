import { describe, expect, test } from "vitest";
import { publishProblem, publishProblemGroups } from "../publish";
import type { DraftQuestion, SurveyDraft } from "../types";

const TODAY = "2026-10-29";

const draft = (over: Partial<SurveyDraft> = {}): SurveyDraft => ({
  title: "איך היה לך באקדמיה?",
  intro: null,
  opensOn: TODAY,
  closesOn: "2026-11-05",
  birthYears: [],
  branchIds: ["b-ka"],
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
  ...over,
});

const q = (over: Partial<DraftQuestion>): DraftQuestion => ({
  ...draft().questions[0],
  ...over,
});

describe("publishProblem", () => {
  test("a complete draft is ready to publish", () => {
    expect(publishProblem(draft(), TODAY)).toEqual([]);
  });

  test("a title shorter than 2 characters once trimmed is refused", () => {
    expect(publishProblem(draft({ title: " א " }), TODAY)).toContain(
      "צריך כותרת של 2 עד 120 תווים",
    );
  });

  test("a title of exactly 120 characters is accepted and 121 is refused", () => {
    expect(publishProblem(draft({ title: "א".repeat(120) }), TODAY)).toEqual([]);
    expect(publishProblem(draft({ title: "א".repeat(121) }), TODAY)).toContain(
      "צריך כותרת של 2 עד 120 תווים",
    );
  });

  test("an intro longer than 500 characters is refused", () => {
    expect(publishProblem(draft({ intro: "א".repeat(501) }), TODAY)).toContain(
      "הפתיח ארוך מ-500 תווים",
    );
  });

  test("a survey needs at least one branch", () => {
    expect(publishProblem(draft({ branchIds: [] }), TODAY)).toContain(
      "צריך לבחור לפחות סניף אחד",
    );
  });

  test("a survey needs at least one question", () => {
    expect(publishProblem(draft({ questions: [] }), TODAY)).toContain(
      "צריך לפחות שאלה אחת",
    );
  });

  test("a survey holds at most 20 questions", () => {
    expect(publishProblem(draft({ questions: Array(21).fill(q({})) }), TODAY)).toContain(
      "אפשר עד 20 שאלות",
    );
  });

  test("a question text shorter than 2 characters is refused", () => {
    expect(publishProblem(draft({ questions: [q({ text: "א" })] }), TODAY)).toContain(
      "שאלה 1: צריך טקסט של 2 עד 300 תווים",
    );
  });

  test("a choice question needs at least two options", () => {
    expect(publishProblem(draft({ questions: [q({ options: ["רק אחת"] })] }), TODAY)).toContain(
      "שאלה 1: צריך 2 עד 10 תשובות",
    );
  });

  test("an empty option is reported as empty", () => {
    expect(
      publishProblem(draft({ questions: [q({ options: ["א", "ב", "  "] })] }), TODAY),
    ).toContain("שאלה 1: תשובה ריקה");
  });

  test("empty options are not also counted as duplicates of each other", () => {
    const problems = publishProblem(
      draft({ questions: [q({ options: ["א", "", "  "] })] }),
      TODAY,
    );
    expect(problems).toContain("שאלה 1: תשובה ריקה");
    expect(problems).not.toContain("שאלה 1: אותה תשובה מופיעה פעמיים");
  });

  test("an option longer than 100 characters is refused", () => {
    expect(
      publishProblem(draft({ questions: [q({ options: ["א", "ב".repeat(101)] })] }), TODAY),
    ).toContain("שאלה 1: תשובה ארוכה מ-100 תווים");
  });

  test("duplicate options ignore surrounding spaces and letter case", () => {
    expect(
      publishProblem(draft({ questions: [q({ options: ["Bit", " bit "] })] }), TODAY),
    ).toContain("שאלה 1: אותה תשובה מופיעה פעמיים");
  });

  test("rating and text questions need no options", () => {
    expect(
      publishProblem(
        draft({
          questions: [q({ kind: "rating", options: [] }), q({ kind: "text", options: [] })],
        }),
        TODAY,
      ),
    ).toEqual([]);
  });

  test("a rating label longer than 40 characters is refused", () => {
    expect(
      publishProblem(
        draft({ questions: [q({ kind: "rating", options: [], lowLabel: "א".repeat(41) })] }),
        TODAY,
      ),
    ).toContain("שאלה 1: תווית ארוכה מ-40 תווים");
  });

  test("a close date before the open date is refused", () => {
    expect(
      publishProblem(draft({ opensOn: "2026-11-10", closesOn: "2026-11-05" }), TODAY),
    ).toContain("תאריך הסגירה לפני תאריך הפתיחה");
  });

  test("a close date in the past is refused", () => {
    expect(
      publishProblem(draft({ opensOn: "2026-10-01", closesOn: "2026-10-28" }), TODAY),
    ).toContain("תאריך הסגירה כבר עבר");
  });

  test("a close date of today is still open and accepted", () => {
    expect(
      publishProblem(draft({ opensOn: "2026-10-01", closesOn: TODAY }), TODAY),
    ).toEqual([]);
  });

  test("a survey without a close date is accepted", () => {
    expect(publishProblem(draft({ closesOn: null }), TODAY)).toEqual([]);
  });

  test("problems come back in form order, with question numbers from 1", () => {
    const problems = publishProblem(
      draft({
        title: "א",
        questions: [q({ text: "א" }), q({ options: ["רק אחת"] })],
      }),
      TODAY,
    );
    expect(problems).toEqual([
      "צריך כותרת של 2 עד 120 תווים",
      "שאלה 1: צריך טקסט של 2 עד 300 תווים",
      "שאלה 2: צריך 2 עד 10 תשובות",
    ]);
  });
});

describe("publishProblemGroups", () => {
  test("a complete draft has no problem in any group", () => {
    expect(publishProblemGroups(draft(), TODAY)).toEqual({ basics: [], questions: [], dates: [] });
  });

  test("title, intro and branch problems are basics, Question problems are questions, date problems are dates", () => {
    const groups = publishProblemGroups(
      draft({
        title: "א",
        branchIds: [],
        closesOn: "2026-10-01",
        questions: [q({ options: ["רק אחת"] })],
      }),
      TODAY,
    );
    expect(groups.basics).toEqual(["צריך כותרת של 2 עד 120 תווים", "צריך לבחור לפחות סניף אחד"]);
    expect(groups.questions).toEqual(["שאלה 1: צריך 2 עד 10 תשובות"]);
    expect(groups.dates).toEqual(["תאריך הסגירה לפני תאריך הפתיחה", "תאריך הסגירה כבר עבר"]);
  });

  test("no Questions is a questions problem", () => {
    expect(publishProblemGroups(draft({ questions: [] }), TODAY).questions).toEqual([
      "צריך לפחות שאלה אחת",
    ]);
  });

  test("the groups, one after the other, are exactly what publishProblem lists", () => {
    const messy = draft({
      title: "א",
      intro: "א".repeat(501),
      branchIds: [],
      closesOn: "2026-10-01",
      questions: [q({ text: "א" }), q({ options: ["", ""] })],
    });
    const groups = publishProblemGroups(messy, TODAY);
    expect(publishProblem(messy, TODAY)).toEqual([
      ...groups.basics,
      ...groups.questions,
      ...groups.dates,
    ]);
  });
});
