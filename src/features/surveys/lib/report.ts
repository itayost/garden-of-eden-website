/**
 * The results report of a Survey. Pure: a loader reads the rows with the service
 * role behind the access check, and buildSurveyReport turns them into what the
 * results page and the CSV export show.
 *
 * - Audience: today's Audience plus anyone who answered, so a Trainee who has
 *   since left the Audience stays in the figures.
 * - Seen: the Seen rows plus anyone who answered, so a rate never passes 100. A
 *   Seen row for someone outside that Audience who did not answer has no name or
 *   branches to place them by, and is ignored.
 * - A responder is placed by the branches of their Response, everyone else by
 *   their current branches.
 * - The viewer's visible branches and the branch and birth-year filters narrow
 *   everything; the name search narrows only the grid page, its count and the
 *   two lists, never `allRows`, so an export is not cut short by it.
 */
import {
  SURVEY_PAGE_SIZE,
  type SurveyOption,
  type SurveyQuestion,
  type AnswerRow,
} from "./types";

export interface ReportPerson {
  profileId: string;
  fullName: string;
  /** Current branches for the Audience; the snapshot when on a ReportResponse. */
  branchIds: readonly string[];
  birthYear: number | null;
}

export interface ReportResponse extends ReportPerson {
  submittedAt: string;
  answers: readonly AnswerRow[];
}

export interface ReportSeen {
  profileId: string;
  firstSeenAt: string;
}

export type ReportSegment = "answered" | "seen" | "unseen";

export interface ReportFilters {
  branchId: string | null;
  birthYear: number | null;
  segment: ReportSegment;
  search: string;
  /** 1-based. */
  page: number;
}

export interface CellAnswer {
  optionLabels: string[];
  rating: number | null;
  text: string | null;
}

/** Who a row is about, with their branches by name. */
export interface ReportIdentity {
  profileId: string;
  fullName: string;
  branchNames: string[];
  birthYear: number | null;
}

export interface GridRow extends ReportIdentity {
  submittedAt: string;
  /** By Question id; a skipped Question has no key. */
  answers: Record<string, CellAnswer>;
}

export interface PersonRow extends ReportIdentity {
  firstSeenAt: string | null;
}

export type RatingCounts = [number, number, number, number, number];

export interface TextAnswer extends ReportIdentity {
  submittedAt: string;
  text: string;
}

export type QuestionSummary = { questionId: string; answered: number } & (
  | { kind: "rating"; average: number | null; counts: RatingCounts }
  | {
      kind: "single_choice" | "multi_choice";
      options: { optionId: string; label: string; count: number; pct: number }[];
    }
  | { kind: "text"; texts: TextAnswer[] }
);

export interface SurveyReport {
  totals: { audience: number; seen: number; answered: number; ratePct: number };
  byBranch: { branchId: string; name: string; seen: number; answered: number; ratePct: number }[];
  questions: QuestionSummary[];
  /**
   * Every Response in scope (visible branches, branch and birth-year filters),
   * newest first, whatever the name search says: the CSV export's source.
   */
  allRows: GridRow[];
  /** The current page of the Responses whose name matches the search. */
  rows: GridRow[];
  /** How many Responses match the search, for the pager. */
  rowCount: number;
  seenNotAnswered: PersonRow[];
  unseen: PersonRow[];
  birthYears: number[];
}

export interface SurveyReportInput {
  questions: readonly SurveyQuestion[];
  branches: readonly { id: string; name: string }[];
  responses: readonly ReportResponse[];
  seen: readonly ReportSeen[];
  audience: readonly ReportPerson[];
  /** The branches the viewer may see; null for an Admin. */
  visibleBranchIds: readonly string[] | null;
  filters: ReportFilters;
}

/** One person the report counts, with where they stand on the Survey. */
interface Member extends ReportPerson {
  response: ReportResponse | null;
  firstSeenAt: string | null;
  hasSeen: boolean;
}

type BranchNamer = (branchIds: readonly string[]) => string[];

/** Whole percent of `whole`; 0, never NaN, when there is no whole. */
function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

function timeOf(iso: string | null): number {
  return iso === null ? 0 : Date.parse(iso);
}

function newestFirst(a: string | null, b: string | null): number {
  return timeOf(b) - timeOf(a);
}

function branchNamer(branches: readonly { id: string; name: string }[]): BranchNamer {
  return (ids) => branches.filter((b) => ids.includes(b.id)).map((b) => b.name);
}

function identityOf(person: ReportPerson, namesOf: BranchNamer): ReportIdentity {
  return {
    profileId: person.profileId,
    fullName: person.fullName,
    branchNames: namesOf(person.branchIds),
    birthYear: person.birthYear,
  };
}

/**
 * The Audience plus every responder, once each. A responder replaces their
 * Audience entry so they are placed by the branches of their Response.
 */
function buildMembers(
  audience: readonly ReportPerson[],
  responses: readonly ReportResponse[],
  seen: readonly ReportSeen[],
): Member[] {
  const firstSeen = new Map(seen.map((s) => [s.profileId, s.firstSeenAt]));
  const people = new Map<string, { person: ReportPerson; response: ReportResponse | null }>([
    ...audience.map((p) => [p.profileId, { person: p, response: null }] as const),
    ...responses.map((r) => [r.profileId, { person: r, response: r }] as const),
  ]);
  return [...people.values()].map(({ person, response }) => ({
    profileId: person.profileId,
    fullName: person.fullName,
    branchIds: person.branchIds,
    birthYear: person.birthYear,
    response,
    firstSeenAt: firstSeen.get(person.profileId) ?? null,
    hasSeen: response !== null || firstSeen.has(person.profileId),
  }));
}

function inVisibleBranches(m: Member, visibleBranchIds: readonly string[] | null): boolean {
  return visibleBranchIds === null || m.branchIds.some((id) => visibleBranchIds.includes(id));
}

/** A person with no birthdate never matches a year. */
function matchesFilters(m: Member, filters: ReportFilters): boolean {
  const inBranch = filters.branchId === null || m.branchIds.includes(filters.branchId);
  const inYear = filters.birthYear === null || m.birthYear === filters.birthYear;
  return inBranch && inYear;
}

function matchesName(fullName: string, search: string): boolean {
  const term = search.trim().toLowerCase();
  return term === "" || fullName.toLowerCase().includes(term);
}

function rateOf(members: readonly Member[]): { seen: number; answered: number; ratePct: number } {
  const seen = members.filter((m) => m.hasSeen).length;
  const answered = members.filter((m) => m.response !== null).length;
  return { seen, answered, ratePct: pct(answered, seen) };
}

type MemberInput = Pick<SurveyReportInput, "responses" | "seen" | "audience" | "visibleBranchIds">;

/** Everyone the report counts in the viewer's visible branches, before any filter. */
function visibleMembersOf(input: MemberInput): Member[] {
  return buildMembers(input.audience, input.responses, input.seen).filter((m) =>
    inVisibleBranches(m, input.visibleBranchIds),
  );
}

function totalsOf(members: readonly Member[]): SurveyReport["totals"] {
  return { audience: members.length, ...rateOf(members) };
}

/**
 * The summary strip's numbers with no filter applied. The Surveys list shows
 * these per row, so a row and the results page it opens always agree.
 */
export function surveyTotals(input: MemberInput): SurveyReport["totals"] {
  return totalsOf(visibleMembersOf(input));
}

/** Only the branches the viewer may see, and only the filtered one when set. */
function byBranchOf(
  members: readonly Member[],
  branches: readonly { id: string; name: string }[],
  visibleBranchIds: readonly string[] | null,
  filters: ReportFilters,
): SurveyReport["byBranch"] {
  return branches
    .filter((b) => visibleBranchIds === null || visibleBranchIds.includes(b.id))
    .filter((b) => filters.branchId === null || filters.branchId === b.id)
    .map((b) => ({
      branchId: b.id,
      name: b.name,
      ...rateOf(members.filter((m) => m.branchIds.includes(b.id))),
    }));
}

function birthYearsOf(members: readonly Member[]): number[] {
  const years = members.flatMap((m) => (m.birthYear === null ? [] : [m.birthYear]));
  return [...new Set(years)].sort((a, b) => b - a);
}

function ratingOf(response: ReportResponse, questionId: string): number | null {
  const found = response.answers.find((a) => a.questionId === questionId && a.rating !== null);
  return found?.rating ?? null;
}

/** Free text of only spaces is not an answer. */
function textOf(response: ReportResponse, questionId: string): string | null {
  const found = response.answers.find(
    (a) => a.questionId === questionId && a.text !== null && a.text.trim() !== "",
  );
  return found?.text ?? null;
}

/** The options a Response picked for a choice Question, in the Question's order. */
function pickedOptions(response: ReportResponse, question: SurveyQuestion): SurveyOption[] {
  return question.options.filter((o) =>
    response.answers.some((a) => a.questionId === question.id && a.optionId === o.id),
  );
}

function cellFor(response: ReportResponse, question: SurveyQuestion): CellAnswer | null {
  if (question.kind === "rating") {
    const rating = ratingOf(response, question.id);
    return rating === null ? null : { optionLabels: [], rating, text: null };
  }
  if (question.kind === "text") {
    const text = textOf(response, question.id);
    return text === null ? null : { optionLabels: [], rating: null, text };
  }
  const picked = pickedOptions(response, question);
  return picked.length === 0
    ? null
    : { optionLabels: picked.map((o) => o.label), rating: null, text: null };
}

function summarizeRating(
  question: SurveyQuestion,
  responders: readonly ReportResponse[],
): QuestionSummary {
  const ratings = responders.flatMap((r) => {
    const rating = ratingOf(r, question.id);
    return rating === null ? [] : [rating];
  });
  const countOf = (value: number) => ratings.filter((rating) => rating === value).length;
  const sum = ratings.reduce((total, rating) => total + rating, 0);
  return {
    questionId: question.id,
    answered: ratings.length,
    kind: "rating",
    average: ratings.length === 0 ? null : Math.round((sum / ratings.length) * 10) / 10,
    counts: [countOf(1), countOf(2), countOf(3), countOf(4), countOf(5)],
  };
}

function summarizeChoice(
  question: SurveyQuestion,
  kind: "single_choice" | "multi_choice",
  responders: readonly ReportResponse[],
): QuestionSummary {
  const picks = responders.map((r) => pickedOptions(r, question)).filter((p) => p.length > 0);
  return {
    questionId: question.id,
    answered: picks.length,
    kind,
    options: question.options.map((option) => {
      const count = picks.filter((p) => p.some((o) => o.id === option.id)).length;
      return { optionId: option.id, label: option.label, count, pct: pct(count, picks.length) };
    }),
  };
}

function summarizeText(
  question: SurveyQuestion,
  responders: readonly ReportResponse[],
  namesOf: BranchNamer,
): QuestionSummary {
  const texts = responders.flatMap((r) => {
    const text = textOf(r, question.id);
    return text === null ? [] : [{ ...identityOf(r, namesOf), submittedAt: r.submittedAt, text }];
  });
  return {
    questionId: question.id,
    answered: texts.length,
    kind: "text",
    texts: [...texts].sort((a, b) => newestFirst(a.submittedAt, b.submittedAt)),
  };
}

function summarizeQuestion(
  question: SurveyQuestion,
  responders: readonly ReportResponse[],
  namesOf: BranchNamer,
): QuestionSummary {
  if (question.kind === "rating") return summarizeRating(question, responders);
  if (question.kind === "text") return summarizeText(question, responders, namesOf);
  return summarizeChoice(question, question.kind, responders);
}

function gridRowsOf(
  responders: readonly ReportResponse[],
  questions: readonly SurveyQuestion[],
  namesOf: BranchNamer,
): GridRow[] {
  const rows = responders.map((r) => ({
    ...identityOf(r, namesOf),
    submittedAt: r.submittedAt,
    answers: Object.fromEntries(
      questions.flatMap((q) => {
        const cell = cellFor(r, q);
        return cell === null ? [] : [[q.id, cell] as const];
      }),
    ),
  }));
  return [...rows].sort((a, b) => newestFirst(a.submittedAt, b.submittedAt));
}

function personRowOf(m: Member, namesOf: BranchNamer): PersonRow {
  return { ...identityOf(m, namesOf), firstSeenAt: m.firstSeenAt };
}

/** Saw the Survey, did not answer: the one first seen last comes first. */
function seenNotAnsweredOf(members: readonly Member[], namesOf: BranchNamer): PersonRow[] {
  return members
    .filter((m) => m.hasSeen && m.response === null)
    .sort((a, b) => newestFirst(a.firstSeenAt, b.firstSeenAt))
    .map((m) => personRowOf(m, namesOf));
}

/** Never saw it, by name. */
function unseenOf(members: readonly Member[], namesOf: BranchNamer): PersonRow[] {
  return members
    .filter((m) => !m.hasSeen)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "he"))
    .map((m) => personRowOf(m, namesOf));
}

export function buildSurveyReport(input: SurveyReportInput): SurveyReport {
  const { questions, branches, visibleBranchIds, filters } = input;
  const namesOf = branchNamer(branches);
  const visible = visibleMembersOf(input);
  const scoped = visible.filter((m) => matchesFilters(m, filters));
  const listed = scoped.filter((m) => matchesName(m.fullName, filters.search));
  const responders = scoped.flatMap((m) => (m.response === null ? [] : [m.response]));
  const allRows = gridRowsOf(responders, questions, namesOf);
  const searchedRows = allRows.filter((row) => matchesName(row.fullName, filters.search));
  const start = (Math.max(1, filters.page) - 1) * SURVEY_PAGE_SIZE;

  return {
    totals: totalsOf(scoped),
    byBranch: byBranchOf(scoped, branches, visibleBranchIds, filters),
    questions: questions.map((q) => summarizeQuestion(q, responders, namesOf)),
    allRows,
    rows: searchedRows.slice(start, start + SURVEY_PAGE_SIZE),
    rowCount: searchedRows.length,
    seenNotAnswered: seenNotAnsweredOf(listed, namesOf),
    unseen: unseenOf(listed, namesOf),
    birthYears: birthYearsOf(visible),
  };
}
