import { AGE_GROUPS, getAgeGroup, type AgeGroup } from "@/types/assessment";

/**
 * A staff-set age group: a trainee who trains with a younger or older group
 * is ranked and rated with it until his next birthday, then goes back to the
 * group of his age. Mirrors effective_age_group() in the database, which the
 * benchmarks use.
 */
export interface AgeGroupProfile {
  birthdate: string | null;
  age_group_override: string | null;
  age_group_override_until: string | null;
}

const AGE_GROUP_IDS = new Set(AGE_GROUPS.map((group) => group.id));

export function isAgeGroupId(value: unknown): value is string {
  return typeof value === "string" && AGE_GROUP_IDS.has(value);
}

/** A calendar date as YYYY-MM-DD, read in local time for a Date. */
function toIsoDate(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * The first birthday strictly after `today` (both YYYY-MM-DD). On the birthday
 * itself that is next year's. A 29 February birthday falls on 28 February in a
 * non-leap year.
 */
export function nextBirthday(birthdate: string, today: string): string {
  const [, month, day] = birthdate.split("-");
  const year = Number(today.slice(0, 4));
  const on = (y: number) =>
    month === "02" && day === "29" && !isLeapYear(y) ? `${y}-02-28` : `${y}-${month}-${day}`;
  const thisYear = on(year);
  return thisYear > today ? thisYear : on(year + 1);
}

/** Whether a staff-set group applies on `asOf` (it ends on its end date). */
export function isAgeGroupOverrideActive(
  profile: AgeGroupProfile,
  asOf: Date | string = new Date()
): boolean {
  const { age_group_override: override, age_group_override_until: until } = profile;
  return isAgeGroupId(override) && until !== null && toIsoDate(asOf) < until;
}

/** The group a trainee belongs to on `asOf`: the override while it lasts, else by age. */
export function resolveAgeGroup(
  profile: AgeGroupProfile,
  asOf: Date | string = new Date()
): AgeGroup | null {
  if (isAgeGroupOverrideActive(profile, asOf)) {
    return AGE_GROUPS.find((group) => group.id === profile.age_group_override) ?? null;
  }
  return getAgeGroup(profile.birthdate, asOf);
}
