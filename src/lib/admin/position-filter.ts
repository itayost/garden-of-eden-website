import {
  POSITIONS,
  POSITION_LABELS_HE,
  type PlayerPosition,
} from "@/types/player-stats";

export const POSITION_FILTER_ALL = "all";
export const POSITION_FILTER_NONE = "none";

export interface PositionFilterOption {
  value: string;
  label: string;
}

export const positionFilterOptions: PositionFilterOption[] = [
  { value: POSITION_FILTER_ALL, label: "כל העמדות" },
  ...POSITIONS.map((p) => ({ value: p, label: POSITION_LABELS_HE[p] })),
  { value: POSITION_FILTER_NONE, label: "ללא עמדה" },
];

export function matchesPositionFilter(
  userPosition: PlayerPosition | string | null | undefined,
  filter: string | null | undefined,
): boolean {
  if (!filter || filter === POSITION_FILTER_ALL) return true;
  if (filter === POSITION_FILTER_NONE) return !userPosition;
  return userPosition === filter;
}
