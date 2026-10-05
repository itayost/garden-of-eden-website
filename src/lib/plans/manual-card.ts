import { MAX_CARD_BALANCE } from "./adjustment";
import { amountProblem } from "./discount";

/**
 * A manual Card: an Admin or the branch's manager types the sessions, the
 * price and how many days it is valid, instead of a catalog Card's terms.
 */
export interface ManualCardTerms {
  sessions: number;
  priceIls: number;
  days: number;
}

/** The longest validity staff may type: two years. */
export const MAX_CARD_DAYS = 730;

/** Why these terms cannot be sold, or null. */
export function manualCardProblem(terms: ManualCardTerms): string | null {
  const whole = (n: number, max: number) => Number.isInteger(n) && n >= 1 && n <= max;
  if (!whole(terms.sessions, MAX_CARD_BALANCE)) return `מספר האימונים בין 1 ל-${MAX_CARD_BALANCE}`;
  const price = amountProblem(terms.priceIls);
  if (price) return price;
  if (!whole(terms.days, MAX_CARD_DAYS)) return `תוקף בימים בין 1 ל-${MAX_CARD_DAYS}`;
  return null;
}

/** How a manual Card is named on the agreement and the receipt. */
export const manualCardLabel = (productName: string, terms: Pick<ManualCardTerms, "sessions" | "days">) =>
  `${productName}: ${terms.sessions} אימונים, ${terms.days} ימים`;

/** The terms a manual Card order was sold on, or null for a catalog sale. */
export function orderManualTerms(order: {
  terms_sessions_total: number | null;
  terms_duration_days: number | null;
}): Pick<ManualCardTerms, "sessions" | "days"> | null {
  return order.terms_sessions_total != null && order.terms_duration_days != null
    ? { sessions: order.terms_sessions_total, days: order.terms_duration_days }
    : null;
}

/** An order's plan name: a manual Card with its typed terms, a catalog sale by its product. */
export function orderPlanName(
  productName: string,
  order: { terms_sessions_total: number | null; terms_duration_days: number | null },
): string {
  const terms = orderManualTerms(order);
  return terms ? manualCardLabel(productName, terms) : productName;
}

/** A staff form's manual Card fields, as typed. */
export interface ManualCardDraft {
  sessions: string;
  price: string;
  days: string;
}

/** The terms to send, or why the draft cannot be sent yet. */
export function readManualCard(draft: ManualCardDraft): { terms: ManualCardTerms | null; problem: string | null } {
  if ([draft.sessions, draft.price, draft.days].some((v) => v.trim() === "")) {
    return { terms: null, problem: "נדרשים אימונים, מחיר ותוקף" };
  }
  const terms = { sessions: Number(draft.sessions), priceIls: Number(draft.price), days: Number(draft.days) };
  const problem = manualCardProblem(terms);
  return problem ? { terms: null, problem } : { terms, problem: null };
}
