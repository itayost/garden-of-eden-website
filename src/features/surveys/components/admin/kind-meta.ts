import { AlignRight, CircleDot, SquareCheckBig, Star, type LucideIcon } from "lucide-react";

import { QUESTION_KINDS, type QuestionKind } from "../../lib/types";

export interface KindMeta {
  label: string;
  Icon: LucideIcon;
}

/** How each Question kind is named and drawn in the builder. */
export const KIND_META: Record<QuestionKind, KindMeta> = {
  rating: { label: "דירוג 1 עד 5", Icon: Star },
  single_choice: { label: "בחירה אחת", Icon: CircleDot },
  multi_choice: { label: "כמה תשובות", Icon: SquareCheckBig },
  text: { label: "טקסט חופשי", Icon: AlignRight },
};

/** The order the kinds are offered in. */
export const KIND_ORDER: readonly QuestionKind[] = ["rating", "single_choice", "multi_choice", "text"];

/** The kind a select or button value names, or null for anything else. */
export function toQuestionKind(value: string): QuestionKind | null {
  return QUESTION_KINDS.find((kind) => kind === value) ?? null;
}
