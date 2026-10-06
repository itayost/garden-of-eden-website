import { MAX_CARD_BALANCE, MAX_CARD_DAYS } from "./adjustment";
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

/**
 * Where a manual Card's form starts: the branch's catalog Card, or ten
 * sessions for ninety days with the price left for staff to type.
 */
export function manualCardDraftFrom(
  base: { sessions_total: number | null; price_ils: number; duration_days: number } | undefined,
): ManualCardDraft {
  return {
    sessions: String(base?.sessions_total ?? 10),
    price: base ? String(base.price_ils) : "",
    days: String(base?.duration_days ?? 90),
  };
}

/**
 * A Plan's name on every screen: a manual Card by the terms it was sold on
 * (its Plan's sessions and days), a catalog product by its own name.
 */
export function planDisplayName(
  product: { name_he: string; staff_terms: boolean },
  plan: { sessions_total: number | null; duration_days: number | null },
): string {
  if (!product.staff_terms || plan.sessions_total == null || plan.duration_days == null) return product.name_he;
  return manualCardLabel(product.name_he, { sessions: plan.sessions_total, days: plan.duration_days });
}
