import type { BookParameter } from "./types";

export function isParameterVisible(
  param: Pick<BookParameter, "isAllPositions" | "positions">,
  position: string | null
): boolean {
  if (position === null) return true;
  if (param.isAllPositions) return true;
  return param.positions.includes(position as BookParameter["positions"][number]);
}
