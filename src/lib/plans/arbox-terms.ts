import { addDays } from "@/lib/utils/iso-date";
import type { PlanProduct } from "@/types/plans";

/** The Arbox fields as the sheet edits them: strings, so a field can be empty mid-edit. */
export interface ArboxTermsDraft {
  startsOn: string;
  endsOn: string;
  sessionsTotal: string;
  amountIls: string;
}

/**
 * What the product would sell, as the starting point for what Arbox sold.
 * The end date counts the start day as day one, as fulfillment does.
 */
export function arboxTermsFromProduct(
  product: Pick<PlanProduct, "sessions_total" | "duration_days" | "price_ils">,
  startsOn: string,
): ArboxTermsDraft {
  return {
    startsOn,
    endsOn: addDays(startsOn, product.duration_days - 1),
    sessionsTotal: product.sessions_total === null ? "" : String(product.sessions_total),
    amountIls: String(product.price_ils),
  };
}

/** How far from today an Arbox plan may start, and how long it may run. */
const START_WINDOW_DAYS = 365;
const MAX_PLAN_DAYS = 366;
const MIN_AMOUNT_ILS = 1;

/**
 * Why these terms cannot be a real Arbox sale, or null. Staff type them, so
 * the server bounds them: a trainer can record a plan but not grant an open
 * one, which only an admin may do through extend and add-sessions.
 */
export function arboxTermsProblem(
  terms: { startsOn: string; endsOn: string; amountIls: number },
  today: string,
): string | null {
  if (terms.endsOn < today) return "המסלול כבר הסתיים";
  if (terms.startsOn < addDays(today, -START_WINDOW_DAYS) || terms.startsOn > addDays(today, START_WINDOW_DAYS)) {
    return "תאריך ההתחלה רחוק מדי מהיום";
  }
  if (terms.endsOn > addDays(terms.startsOn, MAX_PLAN_DAYS - 1)) return "מסלול ארוך משנה";
  if (terms.amountIls < MIN_AMOUNT_ILS) return "הסכום נמוך מדי";
  return null;
}
