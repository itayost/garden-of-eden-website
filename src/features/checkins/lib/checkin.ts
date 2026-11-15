/**
 * The daily Check-in: sleep last night, energy today, and whether the muscles
 * are sore. One per Trainee per Israel day; a second answer replaces the first.
 */

export const SLEEP_MIN = 3;
export const SLEEP_MAX = 12;
export const SLEEP_STEP = 0.5;
export const SLEEP_DEFAULT = 8;

export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export const ENERGY_LEVELS: readonly EnergyLevel[] = [1, 2, 3, 4, 5];

export const ENERGY_LABELS: Record<EnergyLevel, string> = {
  1: "אין כוח",
  2: "עייף",
  3: "בסדר",
  4: "טוב",
  5: "מלא אנרגיה",
};

export interface Checkin {
  /** The Israel date it was answered for. */
  date: string;
  sleepHours: number;
  energy: EnergyLevel;
  soreness: boolean;
}

/** Inside the range and a whole number of half hours. */
export function isSleepHours(value: number): boolean {
  return value >= SLEEP_MIN && value <= SLEEP_MAX && Number.isInteger(value / SLEEP_STEP);
}

/** Half an hour up or down, held inside the range. */
export function stepSleep(current: number, direction: 1 | -1): number {
  return Math.min(SLEEP_MAX, Math.max(SLEEP_MIN, current + direction * SLEEP_STEP));
}

/** 7 reads "7" and 7.5 reads "7.5". */
export function formatSleepHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
