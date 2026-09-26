import type { WeeklyBand } from "@/types/weekly-schedule";

/** The band fields a projected slot copies when it is created. */
export type BandCopy = Pick<WeeklyBand, "start_time" | "label_he" | "location_he">;

export type SlotSyncColumn = "start_time" | "focus_he" | "location_he";

export interface SlotFieldSync {
  column: SlotSyncColumn;
  /** The band's value before the edit; only slots still holding it change. */
  from: string | null;
  to: string | null;
}

/** The DB returns TIME as HH:MM:SS while the band form submits HH:MM. */
const toDbTime = (time: string): string => (time.length === 5 ? `${time}:00` : time);

/**
 * Which slot columns a band edit should carry to the hours it already
 * projected. A slot takes the new value only where it still shows the old one,
 * so a title or time staff changed on a single day stays theirs. Pure, so the
 * rule is tested apart from the queries that apply it.
 */
export function bandSlotSyncs(before: BandCopy, after: BandCopy): SlotFieldSync[] {
  const pairs: SlotFieldSync[] = [
    { column: "start_time", from: toDbTime(before.start_time), to: toDbTime(after.start_time) },
    { column: "focus_he", from: before.label_he, to: after.label_he },
    { column: "location_he", from: before.location_he, to: after.location_he },
  ];
  return pairs.filter((pair) => pair.from !== pair.to);
}
