/**
 * loadWeekInputs(): one Report week of many Trainees, read in parallel through
 * the service role and cut into one TraineeWeekInput each, the input of
 * buildFactSheet(). A failed read throws: a job that writes reports from half
 * the facts is worse than one that stops and logs.
 */
import "server-only";

import { resolveAgeGroup } from "@/lib/age-group-override";
import { CATEGORY_COLUMNS, type ShiftReportForNotes } from "@/lib/utils/trainee-notes";
import type { ArboxEntrance, TraineeWeekInput, WeekRosterRow } from "../fact-sheet/types";
import { reportWeekEnd } from "../report-week";
import {
  readAssessments,
  readBranchNames,
  readDietitianNotes,
  readGroupStats,
  readMeasurements,
  readNextGames,
  readOpenGoals,
  readProfiles,
  type ProfileRead,
} from "./player-reads";
import { type Db, unique } from "./read";
import {
  readCheckins,
  readNotes,
  readPostForms,
  readPreForms,
  readSessions,
  readShiftReports,
  readTags,
  type DayRange,
  type SessionRead,
} from "./week-reads";

/** A Trainee and the report branches the job found for them. */
export interface WeekTrainee {
  id: string;
  branchIds: string[];
}

/**
 * Who trained, as the job already read it for the classifier (loadTrainingRows
 * and loadArboxDays over five weeks). Passed in so the Arbox report is read
 * once a run and the sheet agrees with the classification; cut to the week here.
 */
export interface LoadedTraining {
  roster: ReadonlyMap<string, readonly WeekRosterRow[]>;
  arbox: ReadonlyMap<string, readonly ArboxEntrance[]>;
}

/** Whether any category of the Shift report names the Trainee, by id list or per-trainee key. */
function namesTrainee(report: ShiftReportForNotes, traineeId: string): boolean {
  return CATEGORY_COLUMNS.some((column) => {
    const ids: unknown = report[column.traineeIdsKey];
    const perTrainee: unknown = report[column.perTraineeKey];
    const inIds = Array.isArray(ids) && ids.includes(traineeId);
    const inEntries =
      typeof perTrainee === "object" &&
      perTrainee !== null &&
      !Array.isArray(perTrainee) &&
      Object.hasOwn(perTrainee, traineeId);
    return inIds || inEntries;
  });
}

function inRange(range: DayRange) {
  return (item: { date: string }): boolean => item.date >= range.from && item.date <= range.to;
}

/**
 * A session built for a Slot counts only when the Trainee trained in that
 * Slot (not called off, not cancelled, not a late cancel); a personal
 * session always counts.
 */
function attendedSessions(sessions: readonly SessionRead[], roster: readonly WeekRosterRow[]) {
  const attended = new Set(roster.filter((r) => r.counts && !r.lateCancel).map((r) => r.slotId));
  return sessions.filter((s) => s.slotId === null || attended.has(s.slotId)).map((s) => s.session);
}

type WeekParts = Awaited<ReturnType<typeof readWeekParts>>;

async function readWeekParts(db: Db, ids: readonly string[], branchIds: readonly string[], range: DayRange, today: string) {
  const [
    profiles,
    branchNames,
    shiftReports,
    sessions,
    tags,
    notes,
    checkins,
    preForms,
    postForms,
    assessments,
    measurements,
    dietitianNotes,
    goals,
    nextGames,
  ] = await Promise.all([
    readProfiles(db, ids),
    readBranchNames(db, branchIds),
    readShiftReports(db, range),
    readSessions(db, ids, range),
    readTags(db, ids, range),
    readNotes(db, ids, range),
    readCheckins(db, ids, range),
    readPreForms(db, ids, range),
    readPostForms(db, ids, range),
    readAssessments(db, ids, range.from, range.to),
    readMeasurements(db, ids, range.from, range.to),
    readDietitianNotes(db, ids),
    readOpenGoals(db, ids),
    readNextGames(db, ids, today),
  ]);
  return {
    profiles,
    branchNames,
    shiftReports,
    sessions,
    tags,
    notes,
    checkins,
    preForms,
    postForms,
    assessments,
    measurements,
    dietitianNotes,
    goals,
    nextGames,
  };
}

function inputOf(
  trainee: WeekTrainee,
  profile: ProfileRead,
  parts: WeekParts,
  groupStats: ReadonlyMap<string, TraineeWeekInput["assessment"]["groupStats"]>,
  training: LoadedTraining,
  range: DayRange,
): TraineeWeekInput {
  const id = trainee.id;
  const ageGroup = resolveAgeGroup(profile, range.to);
  const roster = (training.roster.get(id) ?? []).filter(inRange(range));
  const assessment = parts.assessments.get(id) ?? { inWeek: null, previous: null };
  return {
    traineeId: id,
    weekStart: range.from,
    profile: {
      gender: profile.gender,
      birthdate: profile.birthdate,
      position: profile.position,
      ageGroup: ageGroup?.label ?? null,
      branchNames: trainee.branchIds.flatMap((branchId) => {
        const name = parts.branchNames.get(branchId);
        return name === undefined ? [] : [name];
      }),
    },
    roster,
    arbox: (training.arbox.get(id) ?? []).filter(inRange(range)),
    shiftReports: parts.shiftReports.filter((report) => namesTrainee(report, id)),
    sessions: attendedSessions(parts.sessions.get(id) ?? [], roster),
    tags: parts.tags.get(id) ?? [],
    notes: parts.notes.get(id) ?? [],
    checkins: parts.checkins.get(id) ?? [],
    preForms: parts.preForms.get(id) ?? [],
    postForms: parts.postForms.get(id) ?? [],
    assessment: {
      inWeek: assessment.inWeek,
      previous: assessment.previous,
      groupStats: assessment.inWeek && ageGroup ? (groupStats.get(ageGroup.id) ?? null) : null,
    },
    measurement: parts.measurements.get(id) ?? { inWeek: null, previous: null },
    dietitianNote: parts.dietitianNotes.get(id) ?? null,
    goals: parts.goals.get(id) ?? [],
    nextGame: parts.nextGames.get(id) ?? null,
    drillCandidates: [],
  };
}

/**
 * One TraineeWeekInput per Trainee for the Report week starting `weekStart`
 * (Friday to Thursday). `today` bounds the next game. A Trainee whose profile
 * is gone is left out and logged. Drill candidates stay empty until the
 * metric-to-book map exists.
 */
export async function loadWeekInputs(
  db: Db,
  trainees: readonly WeekTrainee[],
  weekStart: string,
  today: string,
  training: LoadedTraining,
): Promise<Map<string, TraineeWeekInput>> {
  if (trainees.length === 0) return new Map();
  const range: DayRange = { from: weekStart, to: reportWeekEnd(weekStart) };
  const ids = unique(trainees.map((t) => t.id));
  const parts = await readWeekParts(db, ids, trainees.flatMap((t) => t.branchIds), range, today);

  const assessedGroups = ids.flatMap((id) => {
    const profile = parts.profiles.get(id);
    const group = profile ? resolveAgeGroup(profile, range.to) : null;
    return parts.assessments.get(id)?.inWeek && group ? [group.id] : [];
  });
  const groupStats = await readGroupStats(db, assessedGroups);

  const missing = trainees.filter((t) => !parts.profiles.has(t.id)).map((t) => t.id);
  if (missing.length > 0) console.warn(`[weekly-reports] ${missing.length} trainees have no profile:`, missing);

  return new Map(
    trainees.flatMap((trainee): [string, TraineeWeekInput][] => {
      const profile = parts.profiles.get(trainee.id);
      return profile ? [[trainee.id, inputOf(trainee, profile, parts, groupStats, training, range)]] : [];
    }),
  );
}
