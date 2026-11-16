/**
 * buildFactSheet(): the one path from a Trainee's week to the model. Pure.
 *
 * Every field of the sheet is picked by name; nothing from the input is
 * spread into it, so a full name, a phone number, a medical note or a field a
 * loader adds later can never ride along. The body facts and the Holds are
 * returned beside the sheet, never inside it.
 */

import { addDays } from "@/lib/utils/iso-date";
import { assessmentFacts } from "./assessment";
import { bodyFacts } from "./body";
import { byDate } from "./format";
import { goalFacts } from "./goals";
import { habitsFacts } from "./habits";
import { shiftReportFacts } from "./shift-notes";
import { attendanceFacts, sessionFacts, tagFacts } from "./training";
import { MISSING_GENDER_HOLD, type BuiltSheet, type FactSheet, type HoldReason, type TraineeWeekInput } from "./types";

/** The first reason of each text, in order. */
function uniqueHolds(holds: readonly HoldReason[]): HoldReason[] {
  return holds.filter((hold, index) => holds.findIndex((h) => h.text === hold.text) === index);
}

function playerOf(profile: TraineeWeekInput["profile"]): FactSheet["player"] {
  return {
    gender: profile.gender,
    ageGroup: profile.ageGroup,
    position: profile.position,
    branches: [...profile.branchNames],
  };
}

export function buildFactSheet(input: TraineeWeekInput): BuiltSheet {
  const shift = shiftReportFacts(input.shiftReports, input.traineeId);
  const tags = tagFacts(input.tags, input.notes);
  const body = bodyFacts(input.measurement, input.dietitianNote);
  const sheet: FactSheet = {
    version: 1,
    week: { from: input.weekStart, to: addDays(input.weekStart, 6) },
    player: playerOf(input.profile),
    attendance: attendanceFacts(input.roster, input.arbox),
    workedOn: byDate([...shift.workedOn, ...sessionFacts(input.sessions)]),
    progress: byDate([...shift.progress, ...tags.progress]),
    habits: habitsFacts(input.checkins, input.preForms, input.postForms),
    assessment: assessmentFacts(input.assessment),
    goals: goalFacts(input.goals),
    drills: input.drillCandidates.map(({ id, name, why }) => ({ id, name, why })),
    nextGame: input.nextGame ? { date: input.nextGame.date, opponent: input.nextGame.opponent } : null,
    hasNewMeasurement: body !== null,
    hasDietitianNote: body?.dietitianNote != null,
  };
  const genderHold = input.profile.gender === null ? [MISSING_GENDER_HOLD] : [];
  return { sheet, body, holds: uniqueHolds([...shift.holds, ...tags.holds, ...genderHold]) };
}
