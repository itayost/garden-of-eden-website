/**
 * Attendance, Training sessions and Quick tags of one Report week, as Fact
 * sheet items and Holds. Pure.
 *
 * A caution Quick tag holds the report and removes that Slot's note from the
 * sheet, since the note may describe the pain. A note on a Slot with no
 * positive tag is not used either: nothing says it is good news.
 */

import { QUICK_TAGS, isCautionTag } from "@/features/quick-tags/lib/tags";
import { hebrewWeekday } from "@/lib/utils/date";
import { byDate, distinct, firstWord, holdDate, textOrNull } from "./format";
import type {
  ArboxEntrance,
  AttendanceDay,
  FactSheet,
  HoldReason,
  ProgressFact,
  WeekExercise,
  WeekNote,
  WeekRosterRow,
  WeekSession,
  WeekTag,
  WorkedOnFact,
} from "./types";

const TAG_ORDER: readonly string[] = QUICK_TAGS.map((tag) => tag.key);

function tagLabel(key: string): string | null {
  return QUICK_TAGS.find((tag) => tag.key === key)?.label ?? null;
}

/** Distinct, non-blank values joined by commas, or null. */
function joined(values: readonly (string | null)[]): string | null {
  const kept = distinct(values.map(textOrNull).filter((v): v is string => v !== null));
  return kept.length === 0 ? null : kept.join(", ");
}

function rosterDay(date: string, rows: readonly WeekRosterRow[]): AttendanceDay {
  const ordered = [...rows].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const trainers = ordered.flatMap((r) => r.trainerFirstNames.map(firstWord)).filter((name) => name !== "");
  return {
    date,
    weekday: hebrewWeekday(date),
    focus: joined(ordered.map((r) => r.focus)),
    trainers: distinct(trainers),
    source: "יומן",
  };
}

function arboxDay(date: string, entrances: readonly ArboxEntrance[]): AttendanceDay {
  return {
    date,
    weekday: hebrewWeekday(date),
    focus: joined(entrances.map((e) => e.className)),
    trainers: [],
    source: "ארבוקס",
  };
}

/**
 * Counted Roster days and Arbox days merged by date, the Roster winning on the
 * same date. A late cancel still costs a session but is not a day trained; it
 * is counted in `lateCancels`.
 */
export function attendanceFacts(
  roster: readonly WeekRosterRow[],
  arbox: readonly ArboxEntrance[],
): FactSheet["attendance"] {
  const trained = roster.filter((r) => r.counts && !r.lateCancel);
  const rosterDates = distinct(trained.map((r) => r.date));
  const arboxDates = distinct(arbox.map((e) => e.date)).filter((date) => !rosterDates.includes(date));
  const days = byDate([
    ...rosterDates.map((date) => rosterDay(date, trained.filter((r) => r.date === date))),
    ...arboxDates.map((date) => arboxDay(date, arbox.filter((e) => e.date === date))),
  ]);
  return {
    total: days.length,
    lateCancels: roster.filter((r) => r.counts && r.lateCancel).length,
    days,
  };
}

function exerciseLine(exercise: WeekExercise): string | null {
  const name = textOrNull(exercise.name);
  if (name === null) return null;
  const category = textOrNull(exercise.category);
  const target = textOrNull(exercise.target);
  return `תרגיל: ${name}${category ? ` (${category})` : ""}${target ? `, ${target}` : ""}`;
}

/** One entry per Training session, one line per exercise. */
export function sessionFacts(sessions: readonly WeekSession[]): WorkedOnFact[] {
  return byDate(sessions).flatMap((session) => {
    const items = session.exercises.map(exerciseLine).filter((line): line is string => line !== null);
    return items.length === 0 ? [] : [{ date: session.date, source: "אימון אישי", items }];
  });
}

function slotFacts(slotTags: readonly WeekTag[], note: WeekNote | undefined): {
  progress: ProgressFact[];
  holds: HoldReason[];
} {
  const date = slotTags[0]?.date ?? "";
  const caution = slotTags.filter((t) => isCautionTag(t.tag));
  const positive = distinct(
    slotTags
      .filter((t) => !isCautionTag(t.tag) && TAG_ORDER.includes(t.tag))
      .map((t) => t.tag)
      .sort((a, b) => TAG_ORDER.indexOf(a) - TAG_ORDER.indexOf(b)),
  );
  const holds = caution.map(
    (t): HoldReason => ({ code: "sensitive", text: `תגית ${tagLabel(t.tag) ?? t.tag} מ-${holdDate(t.date)}` }),
  );
  const details = caution.length > 0 ? null : textOrNull(note?.note);
  const categories = positive.map(tagLabel).filter((label): label is string => label !== null);
  const progress: ProgressFact[] =
    categories.length === 0
      ? []
      : [{ date, source: "תגיות מהאימון", label: "תגיות המאמן", details, categories }];
  return { progress, holds };
}

/** Positive Quick tags per Slot with its note; caution tags hold. */
export function tagFacts(
  tags: readonly WeekTag[],
  notes: readonly WeekNote[],
): { progress: ProgressFact[]; holds: HoldReason[] } {
  const slots = distinct(tags.map((t) => t.slotId)).map((slotId) =>
    slotFacts(
      tags.filter((t) => t.slotId === slotId),
      notes.find((n) => n.slotId === slotId),
    ),
  );
  return {
    progress: byDate(slots.flatMap((s) => s.progress)),
    holds: slots.flatMap((s) => s.holds),
  };
}
