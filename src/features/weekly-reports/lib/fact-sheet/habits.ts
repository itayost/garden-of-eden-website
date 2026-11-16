/**
 * How the Trainee came to training this week: Check-ins first, the
 * pre-workout form's sleep range as a fallback, and the post-workout form's
 * difficulty and satisfaction. Pure.
 */

import type { Checkin } from "@/features/checkins/lib/checkin";
import type { SleepRange } from "@/features/nutrition/types";
import { average } from "./format";
import type { Habits, TraineeWeekInput } from "./types";

const SLEEP_RANGES: readonly SleepRange[] = ["4-6", "6-8", "8-11"];

/** The most common range as "6-8 שעות"; a tie goes to the shorter range. */
function commonSleepRange(preForms: TraineeWeekInput["preForms"]): string | null {
  const counts = SLEEP_RANGES.map((range) => ({
    range,
    count: preForms.filter((form) => form.sleepRange === range).length,
  }));
  const best = counts.reduce((top, entry) => (entry.count > top.count ? entry : top), counts[0]);
  return best.count > 0 ? `${best.range} שעות` : null;
}

function postFormFacts(postForms: TraineeWeekInput["postForms"]): Habits["postForm"] {
  if (postForms.length === 0) return null;
  const known = (values: (number | null)[]) => values.filter((v): v is number => v !== null);
  return {
    difficultyAverage: average(known(postForms.map((f) => f.difficulty))),
    satisfactionAverage: average(known(postForms.map((f) => f.satisfaction))),
  };
}

export function habitsFacts(
  checkins: readonly Checkin[],
  preForms: TraineeWeekInput["preForms"],
  postForms: TraineeWeekInput["postForms"],
): Habits | null {
  const sleep = checkins.map((c) => c.sleepHours);
  const preFormSleep = checkins.length === 0 ? commonSleepRange(preForms) : null;
  const postForm = postFormFacts(postForms);
  if (checkins.length === 0 && preFormSleep === null && postForm === null) return null;
  return {
    checkins: checkins.length,
    sleepAverage: average(sleep),
    sleepLowest: sleep.length === 0 ? null : Math.min(...sleep),
    energyAverage: average(checkins.map((c) => c.energy)),
    sorenessDays: checkins.filter((c) => c.soreness).length,
    preFormSleep,
    postForm,
  };
}
