/**
 * Database rows of the survey tables, and the pure functions that turn them
 * into the feature's own types. The loaders in queries.ts read the rows with
 * the service role; nothing here touches the database, so it is all testable.
 */
import { parseAccessOverride, resolveAccessTier } from "@/lib/access/course-access";
import type { Tables } from "@/types/database";
import { birthYearOf, inSurveyAudience, type AudienceCandidate } from "./audience";
import {
  surveyTotals,
  type ReportPerson,
  type ReportResponse,
  type ReportSeen,
  type SurveyReport,
} from "./report";
import {
  QUESTION_KINDS,
  type AnswerRow,
  type OfferableSurvey,
  type QuestionKind,
  type SurveyQuestion,
  type SurveyRecord,
} from "./types";

/** A surveys row with the branch ids embedded from survey_branches. */
export type SurveyRow = Tables<"surveys"> & { survey_branches: { branch_id: string }[] };

export type OptionRow = Pick<Tables<"survey_question_options">, "id" | "position" | "label">;

/** A survey_questions row with its options embedded. */
export type QuestionRow = Pick<
  Tables<"survey_questions">,
  "id" | "position" | "kind" | "prompt" | "required" | "low_label" | "high_label"
> & { survey_question_options: OptionRow[] };

export type SurveyWithQuestionsRow = SurveyRow & { survey_questions: QuestionRow[] };

export type CandidateRow = Pick<
  Tables<"profiles">,
  | "id"
  | "full_name"
  | "role"
  | "is_active"
  | "deleted_at"
  | "birthdate"
  | "arbox_paid_training"
  | "arbox_bought_course"
  | "access_override"
>;

export type MembershipRow = Pick<Tables<"profile_branches">, "profile_id" | "branch_id">;

export type ResponseRow = Pick<
  Tables<"survey_responses">,
  "id" | "profile_id" | "submitted_at" | "branch_ids"
>;

export type ViewRow = Pick<Tables<"survey_views">, "profile_id" | "first_seen_at">;

export type AnswerDbRow = Pick<
  Tables<"survey_answers">,
  "response_id" | "question_id" | "option_id" | "rating" | "text_value"
>;

export type ReportProfileRow = Pick<Tables<"profiles">, "id" | "full_name" | "birthdate">;

export function toSurveyRecord(row: SurveyRow): SurveyRecord {
  return {
    id: row.id,
    title: row.title,
    intro: row.intro,
    opensOn: row.opens_on,
    closesOn: row.closes_on,
    birthYears: row.birth_years,
    branchIds: row.survey_branches.map((branch) => branch.branch_id).toSorted(),
    createdBy: row.created_by,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    closedAt: row.closed_at,
  };
}

/** The column is free text under a CHECK; this narrows it for the type system. */
function questionKindOf(kind: string): QuestionKind {
  const known = QUESTION_KINDS.find((candidate) => candidate === kind);
  if (known === undefined) throw new Error(`Unknown survey question kind: ${kind}`);
  return known;
}

const byPosition = (a: { position: number }, b: { position: number }): number =>
  a.position - b.position;

/** Questions and their options in the order the Survey asks them. */
export function toQuestions(rows: readonly QuestionRow[]): SurveyQuestion[] {
  return rows.toSorted(byPosition).map((row) => ({
    id: row.id,
    kind: questionKindOf(row.kind),
    text: row.prompt,
    required: row.required,
    lowLabel: row.low_label,
    highLabel: row.high_label,
    options: row.survey_question_options
      .toSorted(byPosition)
      .map((option) => ({ id: option.id, label: option.label })),
  }));
}

/** A draft has no publish date and is never offered. */
export function toOfferableSurvey(
  record: SurveyRecord,
  questions: SurveyQuestion[],
): OfferableSurvey | null {
  if (record.publishedAt === null) return null;
  return {
    id: record.id,
    title: record.title,
    intro: record.intro,
    closesOn: record.closesOn,
    publishedAt: record.publishedAt,
    questions,
  };
}

/**
 * A null role maps to "" so it can never read as "trainee". `branchIds` is
 * every membership of the profile, not only the target branches: the audience
 * rules intersect them with a Survey's branches themselves.
 */
export function toCandidate(row: CandidateRow, branchIds: readonly string[]): AudienceCandidate {
  return {
    profileId: row.id,
    fullName: row.full_name ?? "",
    role: row.role ?? "",
    isActive: row.is_active,
    deletedAt: row.deleted_at,
    birthdate: row.birthdate,
    accessTier: resolveAccessTier({
      arboxPaidTraining: row.arbox_paid_training,
      arboxBoughtCourse: row.arbox_bought_course,
      accessOverride: parseAccessOverride(row.access_override),
    }),
    branchIds,
  };
}

/**
 * Items under their key, in the order given. The built-in grouping helpers are
 * missing on Node 20 (CI), so this stands in for them. The map and its lists
 * are built here and handed out finished.
 */
export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [item]);
    else group.push(item);
  }
  return groups;
}

export function branchIdsByProfile(rows: readonly MembershipRow[]): Map<string, string[]> {
  const grouped = groupBy(rows, (row) => row.profile_id);
  return new Map(
    [...grouped].map(([profileId, memberships]): [string, string[]] => [
      profileId,
      memberships.map((membership) => membership.branch_id),
    ]),
  );
}

function toAnswerRow(row: AnswerDbRow): AnswerRow {
  return {
    questionId: row.question_id,
    optionId: row.option_id,
    rating: row.rating,
    text: row.text_value,
  };
}

/**
 * A Response keeps the branches it was sent from; the name and birth year are
 * the profile's own today. A profile that is gone reads as nameless.
 */
export function toReportResponses(
  responses: readonly ResponseRow[],
  answers: readonly AnswerDbRow[],
  profiles: readonly ReportProfileRow[],
): ReportResponse[] {
  const answersByResponse = groupBy(answers, (answer) => answer.response_id);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return responses.map((response) => {
    const profile = profileById.get(response.profile_id);
    return {
      profileId: response.profile_id,
      fullName: profile?.full_name ?? "",
      branchIds: response.branch_ids,
      birthYear: birthYearOf(profile?.birthdate ?? null),
      submittedAt: response.submitted_at,
      answers: (answersByResponse.get(response.id) ?? []).map(toAnswerRow),
    };
  });
}

export function toReportSeen(rows: readonly ViewRow[]): ReportSeen[] {
  return rows.map((row) => ({ profileId: row.profile_id, firstSeenAt: row.first_seen_at }));
}

export interface SurveyListTotalsInput {
  survey: Pick<SurveyRecord, "branchIds" | "birthYears">;
  /** The branches the viewer may see; null for an Admin. */
  visibleBranchIds: readonly string[] | null;
  /** Trainee profiles in the Survey's branches, every membership listed. */
  candidates: readonly AudienceCandidate[];
  /** This Survey's Responses and Seen rows. */
  responses: readonly ResponseRow[];
  views: readonly ViewRow[];
}

function toReportPerson(candidate: AudienceCandidate): ReportPerson {
  return {
    profileId: candidate.profileId,
    fullName: candidate.fullName,
    branchIds: candidate.branchIds,
    birthYear: birthYearOf(candidate.birthdate),
  };
}

/**
 * The Survey's Audience as the report counts it: the candidates who pass the
 * Survey's own branches and birth years, with their current branches. The
 * results page and the list rows both build it here, so they cannot disagree.
 */
export function audienceReportPeople(
  candidates: readonly AudienceCandidate[],
  survey: Pick<SurveyRecord, "branchIds" | "birthYears">,
): ReportPerson[] {
  return candidates.filter((c) => inSurveyAudience(c, survey)).map(toReportPerson);
}

/**
 * The numbers on a Surveys list row: the results page's own totals (the
 * report's rules, not a copy of them) with no filter, for the branches the
 * viewer may see. The Audience is the candidates who pass the Survey's own
 * branches and birth years, as the results page builds it. Names and answers
 * do not change a count, so the Responses carry none.
 */
export function surveyListTotals(input: SurveyListTotalsInput): SurveyReport["totals"] {
  const { survey, visibleBranchIds, candidates, responses, views } = input;
  return surveyTotals({
    audience: audienceReportPeople(candidates, survey),
    responses: toReportResponses(responses, [], []),
    seen: toReportSeen(views),
    visibleBranchIds,
  });
}
