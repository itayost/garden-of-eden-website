/**
 * An account the academy opened for two children together, named "X + Y".
 * Its Weekly report would describe two players as one, so the week's row goes
 * in held for a person (a `manual` Hold, which approve-all never touches)
 * until staff give each child an account of their own; the Hold then stops by
 * itself, because neither new name has a plus. Pure.
 */
import type { HoldReason } from "./fact-sheet/types";

export const SHARED_ACCOUNT_HOLD: HoldReason = {
  code: "manual",
  text: "חשבון של שני ילדים (+ בשם). לא לשלוח עד שהצוות יפצל אותו",
};

/** A name on each side of a plus, as "ינאל + מוחמד". */
const TWO_NAMES = /\S\s*\+\s*\S/;

export function isSharedAccount(fullName: string | null): boolean {
  return TWO_NAMES.test(fullName ?? "");
}
