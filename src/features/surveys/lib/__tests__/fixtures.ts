/**
 * The results-report fixture shared by report.test.ts and csv.test.ts: two
 * branches, one Question of each kind, six people in today's Audience (one with
 * two branches, one with no birthdate), four who saw the Survey and three
 * Responses, one of them from p7, who is no longer in the Audience.
 */
import type { AnswerRow, SurveyQuestion } from "../types";
import {
  buildSurveyReport,
  type ReportFilters,
  type ReportPerson,
  type ReportResponse,
  type ReportSeen,
} from "../report";

export const KA = "b-ka";
export const HA = "b-ha";

export const branches = [
  { id: KA, name: "קריית אתא" },
  { id: HA, name: "חיפה" },
];

export const questions: SurveyQuestion[] = [
  { id: "q1", kind: "rating", text: "כמה נהנית?", required: true, lowLabel: "בכלל לא", highLabel: "מאוד", options: [] },
  { id: "q2", kind: "single_choice", text: "כמה פעמים?", required: true, lowLabel: null, highLabel: null, options: [{ id: "o1", label: "פעם אחת" }, { id: "o2", label: "פעמיים" }] },
  { id: "q3", kind: "multi_choice", text: "מה עוזר?", required: true, lowLabel: null, highLabel: null, options: [{ id: "m1", label: "תרגילי כדור" }, { id: "m2", label: "משחקונים" }] },
  { id: "q4", kind: "text", text: "מה לשנות?", required: false, lowLabel: null, highLabel: null, options: [] },
];

export const person = (
  profileId: string,
  fullName: string,
  branchIds: string[],
  birthYear: number | null,
): ReportPerson => ({ profileId, fullName, branchIds, birthYear });

export const audience: ReportPerson[] = [
  person("p1", "יונתן לוי", [KA], 2014),
  person("p2", "מאיה גבאי", [KA], 2015),
  person("p3", "אורי בן דוד", [HA], 2014),
  person("p4", "נועם אזולאי", [HA], 2015),
  person("p5", "תמר חדד", [KA, HA], 2014),
  person("p6", "רועי מלכה", [HA], null),
];

export const seen: ReportSeen[] = [
  { profileId: "p1", firstSeenAt: "2026-10-28T15:00:00Z" },
  { profileId: "p2", firstSeenAt: "2026-10-27T09:00:00Z" },
  { profileId: "p3", firstSeenAt: "2026-10-27T09:30:00Z" },
  { profileId: "p5", firstSeenAt: "2026-10-28T08:00:00Z" },
];

export const answer = (questionId: string, over: Partial<AnswerRow>): AnswerRow => ({
  questionId,
  optionId: null,
  rating: null,
  text: null,
  ...over,
});

export const responses: ReportResponse[] = [
  { ...person("p1", "יונתן לוי", [KA], 2014), submittedAt: "2026-10-28T15:42:00Z", answers: [answer("q1", { rating: 5 }), answer("q2", { optionId: "o2" }), answer("q3", { optionId: "m1" }), answer("q3", { optionId: "m2" }), answer("q4", { text: "יותר משחקים" })] },
  { ...person("p3", "אורי בן דוד", [HA], 2014), submittedAt: "2026-10-27T10:00:00Z", answers: [answer("q1", { rating: 4 }), answer("q2", { optionId: "o1" }), answer("q3", { optionId: "m1" })] },
  { ...person("p7", "דניאל אוחיון", [KA], 2015), submittedAt: "2026-10-26T18:00:00Z", answers: [answer("q1", { rating: 2 }), answer("q2", { optionId: "o2" }), answer("q3", { optionId: "m2" })] },
];

export const filters: ReportFilters = { branchId: null, birthYear: null, segment: "answered", search: "", page: 1 };

export const build = (over: Partial<Parameters<typeof buildSurveyReport>[0]> = {}) =>
  buildSurveyReport({ questions, branches, responses, seen, audience, visibleBranchIds: null, filters, ...over });
