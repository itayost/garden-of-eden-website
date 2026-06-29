import type { CanonicalPosition } from "./types";

export const POSITION_GROUPS: { key: string; labelHe: string; positions: CanonicalPosition[]; isAll?: boolean }[] = [
  { key: "all", labelHe: "כל עמדה", positions: [], isAll: true },
  { key: "gk", labelHe: "שוער", positions: ["GK"] },
  { key: "stopper", labelHe: "סטופר", positions: ["CB"] },
  { key: "fullback", labelHe: "מגן", positions: ["RB", "LB"] },
  { key: "cm", labelHe: "קשר", positions: ["CDM", "CM", "CAM"] },
  { key: "wing", labelHe: "קצה", positions: ["LW", "RW"] },
  { key: "attacker", labelHe: "תוקף", positions: ["ST", "CF"] },
];

export function expandPositionGroup(key: string): CanonicalPosition[] {
  const group = POSITION_GROUPS.find((g) => g.key === key);
  return group ? [...group.positions] : [];
}
