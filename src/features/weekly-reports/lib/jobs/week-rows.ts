/**
 * The write job's decisions for one Report week, between the loaders and the
 * rows. Pure: classifyTrainee() puts the audience rules together for one
 * Trainee, weekRows() turns the verdicts and the built sheets into the rows
 * the job inserts, countRows() sums them for the run's result.
 *
 * Kept apart from the job so the composition is tested: an Arbox entrance
 * counts as training, a failed Arbox read turns "התגעגענו" off, and a Freeze
 * on any day of the week means nothing goes out.
 */
import {
  classifyWeek,
  freezeTouchesWeek,
  missedYouAllowed,
  trainingDays,
  type FreezeSpan,
  type ReportSetting,
  type TrainingRow,
  type WeekKind,
} from "../audience";
import type { BuiltSheet } from "../fact-sheet/types";
import type { NewReportRow } from "../queries/rows";
import { isSharedAccount, SHARED_ACCOUNT_HOLD } from "../shared-account";

/** What the job read about one Trainee over the five weeks up to the week's end. */
export interface TraineeTraining {
  traineeId: string;
  /** The Trainee's report branches (reportBranches()). */
  branchIds: readonly string[];
  roster: readonly TrainingRow[];
  arboxDates: readonly string[];
  freezes: readonly FreezeSpan[];
}

/** Report, "התגעגענו", absent or nothing, for one Trainee and one Report week. */
export function classifyTrainee(
  training: TraineeTraining,
  weekStart: string,
  settings: readonly ReportSetting[],
  arboxReadFailed: boolean,
): WeekKind {
  return classifyWeek({
    weekStart,
    days: trainingDays(training.roster, training.arboxDates),
    frozen: training.freezes.some((freeze) => freezeTouchesWeek(freeze, weekStart)),
    missedYouOn: missedYouAllowed(training.branchIds, settings, arboxReadFailed),
  });
}

export interface ClassifiedTrainee {
  traineeId: string;
  /** For the shared-account Hold and the preview's names; never goes into a Fact sheet. */
  fullName: string;
  branchIds: readonly string[];
  kind: WeekKind;
}

function rowOf(weekStart: string, trainee: ClassifiedTrainee, built: BuiltSheet | undefined): NewReportRow | null {
  const base = {
    traineeId: trainee.traineeId,
    weekStart,
    branchIds: [...trainee.branchIds],
    holdReasons: [],
    factSheet: null,
    approvedAutomatically: false,
  };
  const shared = isSharedAccount(trainee.fullName) ? [SHARED_ACCOUNT_HOLD] : [];
  switch (trainee.kind) {
    case "nothing":
      return null;
    case "missed_you":
      // No model writes it, so it needs no approval; staff can still hold it until it goes.
      // A shared account's goes in held: its first name would be only one of the children.
      return shared.length > 0
        ? { ...base, kind: "missed_you", status: "held", holdReasons: shared }
        : { ...base, kind: "missed_you", status: "approved", approvedAutomatically: true };
    case "absent":
      return { ...base, kind: "absent", status: "listed" };
    case "report": {
      if (built === undefined) return null;
      const holds = [...shared, ...built.holds];
      return {
        ...base,
        kind: "report",
        status: holds.length > 0 ? "held" : "pending",
        holdReasons: holds,
        factSheet: { sheet: built.sheet, body: built.body },
      };
    }
  }
}

/**
 * The rows of the week: none for "nothing", none for a report whose sheet
 * could not be built (its profile is gone; the loader logs it).
 */
export function weekRows(
  weekStart: string,
  trainees: readonly ClassifiedTrainee[],
  sheets: ReadonlyMap<string, BuiltSheet>,
): NewReportRow[] {
  return trainees.flatMap((trainee) => {
    const row = rowOf(weekStart, trainee, sheets.get(trainee.traineeId));
    return row === null ? [] : [row];
  });
}

export interface RowCounts {
  reports: number;
  /** Reports held from the start (sensitive entries, missing gender). */
  held: number;
  missedYou: number;
  absent: number;
}

export function countRows(rows: readonly NewReportRow[]): RowCounts {
  const reports = rows.filter((row) => row.kind === "report");
  return {
    reports: reports.length,
    held: reports.filter((row) => row.status === "held").length,
    missedYou: rows.filter((row) => row.kind === "missed_you").length,
    absent: rows.filter((row) => row.kind === "absent").length,
  };
}
