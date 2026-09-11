import { deriveOnDuty } from "@/lib/utils/weekly-schedule";
import type { WeeklyBand, WeeklyException } from "@/types/weekly-schedule";

export const key = (date: string, bandId: string): string => `${date}|${bandId}`;

export interface MaterializationInput {
  /** ISO dates to project, in order. */
  dates: readonly string[];
  bands: readonly WeeklyBand[];
  exceptions: readonly WeeklyException[];
  /** `${date}|${bandId}` of slots that already exist. */
  existing: ReadonlySet<string>;
  /** `${date}|${bandId}` of slots staff deleted; never recreated. */
  tombstones: ReadonlySet<string>;
}

export interface MaterializedSlot {
  date: string;
  band: WeeklyBand;
}

/**
 * Which bookable slots are missing for the dates given. Only bookable,
 * non-standby bands project; a trainer's absence on a date removes their
 * bands for that date through deriveOnDuty, exactly as the board's build
 * does. Pure, so the cron and the on-demand path agree.
 */
export function materializationPlan(input: MaterializationInput): MaterializedSlot[] {
  const bookable = input.bands.filter((b) => b.is_bookable && !b.is_standby);
  if (bookable.length === 0) return [];
  const byId = new Map(bookable.map((b) => [b.id, b]));

  return input.dates.flatMap((date) => {
    const onDuty = deriveOnDuty(date, bookable, input.exceptions);
    return onDuty.bands
      .filter((b) => b.source === "band")
      .map((b) => byId.get(b.id))
      .filter((b): b is WeeklyBand => b !== undefined)
      .filter((b) => !input.existing.has(key(date, b.id)) && !input.tombstones.has(key(date, b.id)))
      .map((band) => ({ date, band }));
  });
}
