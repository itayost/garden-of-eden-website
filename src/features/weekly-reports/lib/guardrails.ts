/**
 * The guardrails every written report passes before a person sees it, and
 * again after every staff edit. Any problem holds the report with its reasons.
 * Pure.
 */

import { allowedNumbers, foreignDigitsIn, numbersIn } from "./fact-sheet/allowed-numbers";
import { MISSING_GENDER_HOLD, TEXT_PROBLEM_CODES, type FactSheet, type HoldReason } from "./fact-sheet/types";
import { forbiddenIn } from "./forbidden-words";
import type { WriterOutput } from "./writer/output";

export const PLAYER_TARGET_WORDS = 110;
export const PARENT_TARGET_WORDS = 140;
export const LENGTH_FACTOR = 1.5;
export const MAX_DRILLS = 3;

function wordCount(text: string): number {
  return text.split(/\s+/).filter((word) => word !== "").length;
}

function numberProblems(sheet: FactSheet, output: WriterOutput): HoldReason[] {
  const allowed = allowedNumbers(sheet);
  const used = [...new Set([...numbersIn(output.player_text), ...numbersIn(output.parent_text)])];
  const invented = used
    .filter((n) => !allowed.has(n))
    .map((n): HoldReason => ({ code: "number", text: `מספר שלא מופיע בנתונים: ${n}` }));
  const foreign = foreignDigitsIn(`${output.player_text}\n${output.parent_text}`)
    ? [{ code: "number" as const, text: "ספרות שאינן 0 עד 9 בטקסט" }]
    : [];
  return [...invented, ...foreign];
}

function drillProblems(sheet: FactSheet, output: WriterOutput): HoldReason[] {
  const offered = new Set(sheet.drills.map((drill) => drill.id));
  const unknown = output.drill_ids.some((id) => !offered.has(id));
  return [
    ...(unknown ? [{ code: "drill" as const, text: "נבחר תרגיל שלא הוצע" }] : []),
    ...(output.drill_ids.length > MAX_DRILLS
      ? [{ code: "drill" as const, text: `נבחרו ${output.drill_ids.length} תרגילים, מותר עד ${MAX_DRILLS}` }]
      : []),
  ];
}

function lengthProblem(text: string, target: number, reader: string): HoldReason[] {
  const count = wordCount(text);
  if (count === 0) return [{ code: "length", text: `הטקסט ${reader} ריק` }];
  if (count > target * LENGTH_FACTOR) return [{ code: "length", text: `הטקסט ${reader} ארוך מדי (${count} מילים)` }];
  return [];
}

export function reportProblems(sheet: FactSheet, output: WriterOutput): HoldReason[] {
  const forbidden = forbiddenIn(`${output.player_text}\n${output.parent_text}`);
  return [
    ...numberProblems(sheet, output),
    ...drillProblems(sheet, output),
    ...lengthProblem(output.player_text, PLAYER_TARGET_WORDS, "לשחקן"),
    ...lengthProblem(output.parent_text, PARENT_TARGET_WORDS, "להורה"),
    ...forbidden.map((phrase): HoldReason => ({ code: "forbidden_word", text: `מילה אסורה: ${phrase}` })),
    ...(sheet.player.gender === null ? [MISSING_GENDER_HOLD] : []),
  ];
}

export function isTextProblem(reason: HoldReason): boolean {
  return TEXT_PROBLEM_CODES.includes(reason.code);
}

/** Keeps every reason that is not a text problem and adds the fresh ones. */
export function replaceTextProblems(current: readonly HoldReason[], fresh: readonly HoldReason[]): HoldReason[] {
  return [...current.filter((reason) => !isTextProblem(reason)), ...fresh];
}
