import { expect, test } from "vitest";
import type { ReportResponse } from "../report";
import { SURVEY_PAGE_SIZE, type SurveyQuestion } from "../types";
import {
  HA,
  KA,
  answer,
  audience,
  branches,
  build,
  filters,
  person,
  questions,
  responses,
  seen,
} from "./fixtures";

test("totals count responders who left the Audience and as Seen", () => {
  expect(build().totals).toEqual({ audience: 7, seen: 5, answered: 3, ratePct: 60 });
});

test("by branch uses the snapshot for responders", () => {
  expect(build().byBranch).toEqual([
    { branchId: KA, name: "קריית אתא", seen: 4, answered: 2, ratePct: 50 },
    { branchId: HA, name: "חיפה", seen: 2, answered: 1, ratePct: 50 },
  ]);
});

test("question summaries", () => {
  const [q1, q2, q3, q4] = build().questions;
  expect(q1).toMatchObject({ kind: "rating", answered: 3, counts: [0, 1, 0, 1, 1], average: 3.7 });
  expect(q2).toMatchObject({ answered: 3, options: [{ optionId: "o1", count: 1, pct: 33 }, { optionId: "o2", count: 2, pct: 67 }] });
  expect(q3).toMatchObject({ answered: 3, options: [{ optionId: "m1", count: 2, pct: 67 }, { optionId: "m2", count: 2, pct: 67 }] });
  expect(q4).toMatchObject({ kind: "text", answered: 1, texts: [{ profileId: "p1", text: "יותר משחקים", branchNames: ["קריית אתא"] }] });
});

test("grid rows newest first, cells by question", () => {
  const rep = build();
  expect(rep.rows.map((x) => x.profileId)).toEqual(["p1", "p3", "p7"]);
  expect(rep.rows[0].answers.q3).toEqual({ optionLabels: ["תרגילי כדור", "משחקונים"], rating: null, text: null });
  expect(rep.rows[1].answers.q4).toBeUndefined();
  expect(rep.rowCount).toBe(3);
});

test("lists: saw but did not answer newest first; unseen by name", () => {
  const rep = build();
  expect(rep.seenNotAnswered.map((x) => x.profileId)).toEqual(["p5", "p2"]);
  expect(rep.unseen.map((x) => x.profileId)).toEqual(["p4", "p6"]);
});

test("a manager sees only their branch, a two-branch trainee once", () => {
  const rep = build({ visibleBranchIds: [KA] });
  expect(rep.totals).toEqual({ audience: 4, seen: 4, answered: 2, ratePct: 50 });
  expect(rep.byBranch.map((b) => b.branchId)).toEqual([KA]);
  expect(rep.seenNotAnswered.map((x) => x.profileId)).toEqual(["p5", "p2"]);
  expect(rep.questions[0]).toMatchObject({ counts: [0, 1, 0, 0, 1], average: 3.5 });
});

test("birth-year filter narrows everything; no birthdate never matches a year", () => {
  expect(build({ filters: { ...filters, birthYear: 2014 } }).totals).toEqual({ audience: 3, seen: 3, answered: 2, ratePct: 67 });
});

test("branch filter", () => {
  expect(build({ filters: { ...filters, branchId: HA } }).totals).toEqual({ audience: 4, seen: 2, answered: 1, ratePct: 50 });
});

test("search narrows lists, not the statistics", () => {
  const rep = build({ filters: { ...filters, segment: "seen", search: " גבאי " } });
  expect(rep.seenNotAnswered.map((x) => x.profileId)).toEqual(["p2"]);
  expect(rep.totals.answered).toBe(3);
});

test("paging is 1-based and keeps the count", () => {
  const rep = build({ filters: { ...filters, page: 2 } });
  expect(rep.rows).toEqual([]);
  expect(rep.rowCount).toBe(3);
  expect(rep.allRows).toHaveLength(3);
});

test("years in the Audience, newest first", () => {
  expect(build().birthYears).toEqual([2015, 2014]);
});

test("an untouched survey has zeros, not NaN", () => {
  const rep = build({ responses: [], seen: [] });
  expect(rep.totals).toEqual({ audience: 6, seen: 0, answered: 0, ratePct: 0 });
  expect(rep.questions[0]).toMatchObject({ average: null, counts: [0, 0, 0, 0, 0] });
  expect(rep.questions[1]).toMatchObject({ options: [{ count: 0, pct: 0 }, { count: 0, pct: 0 }] });
});

test("an untouched survey with no Audience at all has zero rates everywhere", () => {
  const rep = build({ responses: [], seen: [], audience: [] });
  expect(rep.totals).toEqual({ audience: 0, seen: 0, answered: 0, ratePct: 0 });
  expect(rep.byBranch.map((b) => b.ratePct)).toEqual([0, 0]);
  expect(rep.birthYears).toEqual([]);
});

// Decisions beyond the brief's fixture.

test("a responder is placed by the snapshot branches, not the current ones", () => {
  const moved = audience.map((p) => (p.profileId === "p1" ? person("p1", "יונתן לוי", [HA], 2014) : p));
  const rep = build({ audience: moved });
  expect(rep.byBranch).toEqual([
    { branchId: KA, name: "קריית אתא", seen: 4, answered: 2, ratePct: 50 },
    { branchId: HA, name: "חיפה", seen: 2, answered: 1, ratePct: 50 },
  ]);
  expect(rep.rows[0].branchNames).toEqual(["קריית אתא"]);
});

test("a Seen row for someone outside the Audience who did not answer is ignored", () => {
  const rep = build({ seen: [...seen, { profileId: "p-gone", firstSeenAt: "2026-10-28T12:00:00Z" }] });
  expect(rep.totals).toEqual({ audience: 7, seen: 5, answered: 3, ratePct: 60 });
  expect(rep.seenNotAnswered.map((x) => x.profileId)).toEqual(["p5", "p2"]);
});

test("a responder who never has a Seen row still counts as Seen and is not listed as unseen", () => {
  const rep = build({ seen: [] });
  expect(rep.totals).toEqual({ audience: 7, seen: 3, answered: 3, ratePct: 100 });
  expect(rep.unseen.map((x) => x.profileId)).toEqual(["p2", "p4", "p6", "p5"]);
});

test("the branch filter narrows the lists and the per-branch rows too", () => {
  const rep = build({ filters: { ...filters, branchId: HA } });
  expect(rep.byBranch).toEqual([{ branchId: HA, name: "חיפה", seen: 2, answered: 1, ratePct: 50 }]);
  expect(rep.seenNotAnswered.map((x) => x.profileId)).toEqual(["p5"]);
  expect(rep.unseen.map((x) => x.profileId)).toEqual(["p4", "p6"]);
  expect(rep.rows.map((x) => x.profileId)).toEqual(["p3"]);
});

test("search narrows the grid page, its count and the lists by name, not the question summaries", () => {
  const rep = build({ filters: { ...filters, search: "לוי" } });
  expect(rep.rows.map((x) => x.profileId)).toEqual(["p1"]);
  expect(rep.rowCount).toBe(1);
  expect(rep.seenNotAnswered).toEqual([]);
  expect(rep.questions[0]).toMatchObject({ answered: 3 });
  expect(rep.questions[3]).toMatchObject({ answered: 1 });
});

test("allRows, the CSV source, ignores the name search so an export is never cut short", () => {
  const rep = build({ filters: { ...filters, search: "לוי" } });
  expect(rep.allRows.map((x) => x.profileId)).toEqual(["p1", "p3", "p7"]);
  expect(rep.rows.map((x) => x.profileId)).toEqual(["p1"]);
  expect(rep.rowCount).toBe(1);
});

test("allRows keeps the branch, birth-year and visible-branch narrowing under a search", () => {
  const byBranch = build({ filters: { ...filters, branchId: KA, search: "לוי" } });
  expect(byBranch.allRows.map((x) => x.profileId)).toEqual(["p1", "p7"]);
  expect(byBranch.rows.map((x) => x.profileId)).toEqual(["p1"]);
  const byYear = build({ filters: { ...filters, birthYear: 2014, search: "אורי" } });
  expect(byYear.allRows.map((x) => x.profileId)).toEqual(["p1", "p3"]);
  expect(byYear.rows.map((x) => x.profileId)).toEqual(["p3"]);
  const manager = build({ visibleBranchIds: [KA], filters: { ...filters, search: "אוחיון" } });
  expect(manager.allRows.map((x) => x.profileId)).toEqual(["p1", "p7"]);
  expect(manager.rows.map((x) => x.profileId)).toEqual(["p7"]);
});

test("person rows carry names, branches, year and the first-seen time", () => {
  const rep = build();
  expect(rep.seenNotAnswered[0]).toEqual({
    profileId: "p5",
    fullName: "תמר חדד",
    branchNames: ["קריית אתא", "חיפה"],
    birthYear: 2014,
    firstSeenAt: "2026-10-28T08:00:00Z",
  });
  expect(rep.unseen[1]).toMatchObject({ profileId: "p6", birthYear: null, firstSeenAt: null });
});

test("free-text answers run newest first with who wrote them", () => {
  const withText: ReportResponse[] = [
    responses[1],
    { ...responses[0], answers: [answer("q4", { text: "פחות ריצה" })] },
    { ...responses[2], answers: [answer("q4", { text: "יותר כדורגל" })] },
  ];
  const q4 = build({ responses: withText }).questions[3];
  expect(q4).toMatchObject({ kind: "text", answered: 2 });
  expect(q4.kind === "text" && q4.texts.map((t) => [t.profileId, t.text, t.submittedAt])).toEqual([
    ["p1", "פחות ריצה", "2026-10-28T15:42:00Z"],
    ["p7", "יותר כדורגל", "2026-10-26T18:00:00Z"],
  ]);
});

test("a text answer of only spaces is not an answer", () => {
  const blank: ReportResponse[] = [{ ...responses[0], answers: [answer("q4", { text: "   " })] }];
  const rep = build({ responses: blank });
  expect(rep.questions[3]).toMatchObject({ answered: 0, texts: [] });
  expect(rep.rows[0].answers.q4).toBeUndefined();
});

test("shares are of those who answered that Question, not of every Response", () => {
  const optional: SurveyQuestion[] = [
    { id: "q9", kind: "single_choice", text: "איפה?", required: false, lowLabel: null, highLabel: null, options: [{ id: "a", label: "בית" }, { id: "b", label: "חוץ" }] },
  ];
  const partial: ReportResponse[] = [
    { ...responses[0], answers: [answer("q9", { optionId: "a" })] },
    { ...responses[1], answers: [answer("q9", { optionId: "a" })] },
    { ...responses[2], answers: [] },
  ];
  const q9 = build({ questions: optional, responses: partial }).questions[0];
  expect(q9).toMatchObject({ answered: 2, options: [{ optionId: "a", count: 2, pct: 100 }, { optionId: "b", count: 0, pct: 0 }] });
});

test("grid cells for a rating and a single choice", () => {
  const row = build().rows[0];
  expect(row.answers.q1).toEqual({ optionLabels: [], rating: 5, text: null });
  expect(row.answers.q2).toEqual({ optionLabels: ["פעמיים"], rating: null, text: null });
  expect(row.answers.q4).toEqual({ optionLabels: [], rating: null, text: "יותר משחקים" });
});

test("a multiple choice lists its labels in the Question's order", () => {
  const reversed: ReportResponse[] = [
    { ...responses[0], answers: [answer("q3", { optionId: "m2" }), answer("q3", { optionId: "m1" })] },
  ];
  expect(build({ responses: reversed }).rows[0].answers.q3?.optionLabels).toEqual(["תרגילי כדור", "משחקונים"]);
});

test("the grid is paged by the page size, newest first", () => {
  const many: ReportResponse[] = Array.from({ length: SURVEY_PAGE_SIZE + 5 }, (_, i) => ({
    ...person(`r${i}`, `חניך ${i}`, [KA], 2014),
    submittedAt: new Date(Date.UTC(2026, 9, 1, 8, i)).toISOString(),
    answers: [],
  }));
  const first = build({ responses: many });
  const second = build({ responses: many, filters: { ...filters, page: 2 } });
  expect(first.rows).toHaveLength(SURVEY_PAGE_SIZE);
  expect(first.rows[0].profileId).toBe(`r${SURVEY_PAGE_SIZE + 4}`);
  expect(second.rows.map((x) => x.profileId)).toEqual(["r4", "r3", "r2", "r1", "r0"]);
  expect(first.rowCount).toBe(SURVEY_PAGE_SIZE + 5);
  expect(first.allRows).toHaveLength(SURVEY_PAGE_SIZE + 5);
});

test("the years offered ignore the filters and keep to the branches the viewer may see", () => {
  const wide = [...audience, person("p9", "גיל כהן", [HA], 2012)];
  expect(build({ audience: wide }).birthYears).toEqual([2015, 2014, 2012]);
  expect(build({ audience: wide, visibleBranchIds: [KA] }).birthYears).toEqual([2015, 2014]);
  expect(build({ audience: wide, filters: { ...filters, birthYear: 2014 } }).birthYears).toEqual([2015, 2014, 2012]);
});

test("the inputs are not changed", () => {
  const before = JSON.stringify({ audience, seen, responses, branches, questions });
  build({ filters: { ...filters, search: "לוי" } });
  expect(JSON.stringify({ audience, seen, responses, branches, questions })).toBe(before);
});
