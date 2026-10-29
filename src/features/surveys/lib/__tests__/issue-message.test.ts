import { describe, expect, test } from "vitest";

import { surveyDraftSchema, surveySubmitSchema } from "@/lib/validations/surveys";
import { hebrewIssueMessage } from "../issue-message";

const FALLBACK = "קלט לא תקין";

describe("hebrewIssueMessage", () => {
  test("the first issue's message when it is written in Hebrew", () => {
    const issues = [{ message: "הכותרת קצרה מדי (מינימום 2 תווים)" }, { message: "מזהה לא תקין" }];
    expect(hebrewIssueMessage(issues, FALLBACK)).toBe("הכותרת קצרה מדי (מינימום 2 תווים)");
  });

  test("a message with Hebrew among digits and punctuation counts as Hebrew", () => {
    expect(hebrewIssueMessage([{ message: "אפשר עד 20 שאלות" }], FALLBACK)).toBe("אפשר עד 20 שאלות");
  });

  test("Zod's English default text is replaced by the fallback", () => {
    const issues = [{ message: "Invalid input: expected string, received undefined" }];
    expect(hebrewIssueMessage(issues, FALLBACK)).toBe(FALLBACK);
  });

  test("only the first issue is judged: a later Hebrew one does not rescue an English first", () => {
    const issues = [{ message: "Too small: expected array to have >=1 items" }, { message: "מזהה לא תקין" }];
    expect(hebrewIssueMessage(issues, FALLBACK)).toBe(FALLBACK);
  });

  test("no issues, or an empty message, gives the fallback", () => {
    expect(hebrewIssueMessage([], FALLBACK)).toBe(FALLBACK);
    expect(hebrewIssueMessage([{ message: "" }], FALLBACK)).toBe(FALLBACK);
  });
});

describe("hebrewIssueMessage with the real schemas", () => {
  test("a malformed submit (no answers array) never shows Zod's English text", () => {
    const parsed = surveySubmitSchema.safeParse({ surveyId: "11111111-1111-4111-8111-111111111111" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0].message).not.toMatch(/[א-ת]/);
    expect(hebrewIssueMessage(parsed.error.issues, FALLBACK)).toBe(FALLBACK);
  });

  test("a rule the schema words itself keeps its Hebrew text", () => {
    const parsed = surveySubmitSchema.safeParse({ surveyId: "not-a-uuid", answers: [] });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(hebrewIssueMessage(parsed.error.issues, FALLBACK)).toBe("מזהה לא תקין");
  });

  test("a draft missing a field falls back instead of showing English", () => {
    const parsed = surveyDraftSchema.safeParse({ title: "סקר" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(hebrewIssueMessage(parsed.error.issues, FALLBACK)).toBe(FALLBACK);
  });
});
