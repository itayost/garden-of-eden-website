/**
 * Survey loaders. Every table here is read only by server code with the
 * service role, behind the caller's access check; nothing in this file checks
 * who is asking. A read that fails is logged and thrown, so a page fails
 * loudly instead of showing an empty report as if nobody had answered.
 *
 * Reads that can pass 1000 rows, or that are keyed by a growing id list, go
 * through readAllPages / readInChunks, ordered by a unique column. The
 * embedded reads (a Survey's branches, Questions and options) are bounded by
 * the builder's limits: 20 Questions of at most 10 options each.
 */
import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages, readInChunks } from "@/lib/supabase/in-chunks";
import { inSurveyAudience, type AudienceCandidate } from "./audience";
import { canViewSurvey, visibleSurveyBranches } from "./permissions";
import type { ReportResponse, ReportSeen } from "./report";
import {
  branchIdsByProfile,
  groupBy,
  surveyListTotals,
  toCandidate,
  toOfferableSurvey,
  toQuestions,
  toReportResponses,
  toReportSeen,
  toSurveyRecord,
  type ResponseRow,
  type ViewRow,
} from "./rows";
import { surveyState } from "./state";
import type {
  OfferableSurvey,
  SurveyQuestion,
  SurveyRecord,
  SurveyState,
  SurveyViewer,
} from "./types";

type Db = ReturnType<typeof createAdminClient>;

const SURVEY_WITH_BRANCHES = "*, survey_branches(branch_id)";

const SURVEY_WITH_QUESTIONS =
  "*, survey_branches(branch_id), survey_questions(id, position, kind, prompt, required, low_label, high_label, survey_question_options(id, position, label))";

const CANDIDATE_COLUMNS =
  "id, full_name, role, is_active, deleted_at, birthdate, arbox_paid_training, arbox_bought_course, access_override";

/** The rows of a finished read, or a logged and thrown failure. */
function must<T>(what: string, result: { data: T; error: { message: string } | null }): T {
  if (result.error) {
    console.error(`[surveys] ${what} failed:`, result.error.message);
    throw new Error(`Surveys: ${what} failed`);
  }
  return result.data;
}

const unique = (ids: readonly string[]): string[] => [...new Set(ids)];

export interface LoadedSurvey {
  record: SurveyRecord;
  questions: SurveyQuestion[];
  responseCount: number;
}

/** One Survey with its Questions and options in order, or null when it does not exist. */
export async function loadSurvey(db: Db, surveyId: string): Promise<LoadedSurvey | null> {
  const [survey, responses] = await Promise.all([
    db.from("surveys").select(SURVEY_WITH_QUESTIONS).eq("id", surveyId).maybeSingle(),
    db.from("survey_responses").select("id", { count: "exact", head: true }).eq("survey_id", surveyId),
  ]);
  const row = must("survey read", survey);
  must("response count", responses);
  if (row === null) return null;
  return {
    record: toSurveyRecord(row),
    questions: toQuestions(row.survey_questions),
    responseCount: responses.count ?? 0,
  };
}

/**
 * Trainee-role profiles with a membership in any of the branches, each with
 * every branch they belong to (not only these): the audience rules intersect
 * them with a Survey's branches themselves.
 */
export async function loadAudienceCandidates(
  db: Db,
  branchIds: readonly string[],
): Promise<AudienceCandidate[]> {
  if (branchIds.length === 0) return [];
  const members = must(
    "audience members read",
    await readInChunks(branchIds, "branch_id", () =>
      db.from("profile_branches").select("profile_id").order("profile_id").order("branch_id"),
    ),
  );
  const profileIds = unique(members.map((member) => member.profile_id));
  const [profiles, memberships] = await Promise.all([
    readInChunks(profileIds, "id", () =>
      db.from("profiles").select(CANDIDATE_COLUMNS).eq("role", "trainee").order("id"),
    ),
    readInChunks(profileIds, "profile_id", () =>
      db.from("profile_branches").select("profile_id, branch_id").order("profile_id").order("branch_id"),
    ),
  ]);
  const branchesOf = branchIdsByProfile(must("audience memberships read", memberships));
  return must("audience profiles read", profiles).map((row) =>
    toCandidate(row, branchesOf.get(row.id) ?? []),
  );
}

/** One profile as the audience rules see it, whatever its role; null when it does not exist. */
export async function loadCandidate(db: Db, profileId: string): Promise<AudienceCandidate | null> {
  const [profile, memberships] = await Promise.all([
    db.from("profiles").select(CANDIDATE_COLUMNS).eq("id", profileId).maybeSingle(),
    readAllPages(() =>
      db.from("profile_branches").select("branch_id").eq("profile_id", profileId).order("branch_id"),
    ),
  ]);
  const row = must("candidate read", profile);
  const branches = must("candidate memberships read", memberships);
  if (row === null) return null;
  return toCandidate(row, branches.map((membership) => membership.branch_id));
}

export interface SurveyListRow {
  id: string;
  title: string;
  state: SurveyState;
  branchNames: string[];
  birthYears: number[];
  answered: number;
  seen: number;
  audience: number;
  /** Answered out of seen, in whole percent: the results page's own figure. */
  ratePct: number;
  opensOn: string;
  closesOn: string | null;
  writerName: string;
}

/** What the list rows are counted from, read once for every listed Survey. */
interface ListReads {
  candidates: AudienceCandidate[];
  responsesBySurvey: Map<string, (ResponseRow & { survey_id: string })[]>;
  viewsBySurvey: Map<string, (ViewRow & { survey_id: string })[]>;
  branches: { id: string; name_he: string }[];
  writerNames: Map<string, string>;
}

async function readListReads(db: Db, surveys: readonly SurveyRecord[]): Promise<ListReads> {
  const surveyIds = surveys.map((survey) => survey.id);
  const [responses, views, candidates, branches, writers] = await Promise.all([
    readInChunks(surveyIds, "survey_id", () =>
      db
        .from("survey_responses")
        .select("id, survey_id, profile_id, submitted_at, branch_ids")
        .order("id"),
    ),
    readInChunks(surveyIds, "survey_id", () =>
      db
        .from("survey_views")
        .select("survey_id, profile_id, first_seen_at")
        .order("survey_id")
        .order("profile_id"),
    ),
    // The Survey's own branches, not only the viewer's: the Audience is the
    // one the results page builds, and the totals narrow it to the viewer.
    loadAudienceCandidates(db, unique(surveys.flatMap((survey) => survey.branchIds))),
    readAllPages(() => db.from("branches").select("id, name_he").order("order_index").order("id")),
    readInChunks(unique(surveys.map((survey) => survey.createdBy)), "id", () =>
      db.from("profiles").select("id, full_name").order("id"),
    ),
  ]);
  return {
    candidates,
    responsesBySurvey: groupBy(must("list responses read", responses), (r) => r.survey_id),
    viewsBySurvey: groupBy(must("list views read", views), (v) => v.survey_id),
    branches: must("list branches read", branches),
    writerNames: new Map(
      must("list writers read", writers).map((writer) => [writer.id, writer.full_name ?? ""]),
    ),
  };
}

function toListRow(
  record: SurveyRecord,
  visibleBranchIds: readonly string[] | null,
  reads: ListReads,
  today: string,
): SurveyListRow {
  return {
    id: record.id,
    title: record.title,
    state: surveyState(record, today),
    branchNames: reads.branches
      .filter((branch) => record.branchIds.includes(branch.id))
      .map((branch) => branch.name_he),
    birthYears: [...record.birthYears],
    ...surveyListTotals({
      survey: record,
      visibleBranchIds,
      candidates: reads.candidates,
      responses: reads.responsesBySurvey.get(record.id) ?? [],
      views: reads.viewsBySurvey.get(record.id) ?? [],
    }),
    opensOn: record.opensOn,
    closesOn: record.closesOn,
    writerName: reads.writerNames.get(record.createdBy) ?? "",
  };
}

/**
 * Every Survey the viewer may see, newest first, with its counts narrowed to
 * the branches the viewer may see. The reads for all listed Surveys are
 * batched: one pass over their Responses, Seen rows and Audience, not one per
 * Survey.
 */
export async function loadSurveyList(
  db: Db,
  viewer: SurveyViewer,
  today: string,
): Promise<SurveyListRow[]> {
  const rows = must(
    "survey list read",
    await readAllPages(() =>
      db
        .from("surveys")
        .select(SURVEY_WITH_BRANCHES)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
    ),
  );
  const visible = rows
    .map(toSurveyRecord)
    .filter((record) => canViewSurvey(viewer.role, viewer.managedBranchIds, record.branchIds));
  if (visible.length === 0) return [];

  const visibleBranchesOf = (record: SurveyRecord) =>
    visibleSurveyBranches(viewer.role, viewer.managedBranchIds, record.branchIds);
  const reads = await readListReads(db, visible);
  return visible.map((record) => toListRow(record, visibleBranchesOf(record), reads, today));
}

/**
 * Every Response of a Survey with its answers, and every Seen row, for the
 * results report. The report narrows them to what the viewer may see.
 */
export async function loadReportRows(
  db: Db,
  surveyId: string,
): Promise<{ responses: ReportResponse[]; seen: ReportSeen[] }> {
  const [responseRows, viewRows] = await Promise.all([
    readAllPages(() =>
      db
        .from("survey_responses")
        .select("id, profile_id, submitted_at, branch_ids")
        .eq("survey_id", surveyId)
        .order("id"),
    ),
    readAllPages(() =>
      db
        .from("survey_views")
        .select("profile_id, first_seen_at")
        .eq("survey_id", surveyId)
        .order("profile_id"),
    ),
  ]);
  const responses = must("report responses read", responseRows);
  const views = must("report views read", viewRows);
  const [answers, profiles] = await Promise.all([
    readInChunks(
      responses.map((response) => response.id),
      "response_id",
      () =>
        db
          .from("survey_answers")
          .select("id, response_id, question_id, option_id, rating, text_value")
          .order("id"),
    ),
    readInChunks(
      unique(responses.map((response) => response.profile_id)),
      "id",
      () => db.from("profiles").select("id, full_name, birthdate").order("id"),
    ),
  ]);
  return {
    responses: toReportResponses(
      responses,
      must("report answers read", answers),
      must("report profiles read", profiles),
    ),
    seen: toReportSeen(views),
  };
}

/**
 * The Surveys this Trainee could answer today: published, not closed, open
 * today, the Trainee in the Audience and no Response yet. In no particular
 * order; the caller picks which to show.
 */
export async function loadOfferableSurveys(
  db: Db,
  profileId: string,
  today: string,
): Promise<OfferableSurvey[]> {
  const [candidate, surveys, answered] = await Promise.all([
    loadCandidate(db, profileId),
    readAllPages(() =>
      db
        .from("surveys")
        .select(SURVEY_WITH_QUESTIONS)
        .not("published_at", "is", null)
        .is("closed_at", null)
        .lte("opens_on", today)
        .order("id"),
    ),
    readAllPages(() =>
      db.from("survey_responses").select("survey_id").eq("profile_id", profileId).order("id"),
    ),
  ]);
  const rows = must("open surveys read", surveys);
  const answeredIds = new Set(must("answered surveys read", answered).map((r) => r.survey_id));
  if (candidate === null) return [];

  return rows.flatMap((row) => {
    const record = toSurveyRecord(row);
    // closes_on is judged here, with the rest of the open-today rule.
    if (surveyState(record, today) !== "open" || answeredIds.has(record.id)) return [];
    if (!inSurveyAudience(candidate, record)) return [];
    const offer = toOfferableSurvey(record, toQuestions(row.survey_questions));
    return offer === null ? [] : [offer];
  });
}
