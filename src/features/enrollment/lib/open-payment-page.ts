import "server-only";

import { headers } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { openPelecardPage } from "@/lib/payments/pelecard";
import { readCachedPage, rememberPage } from "@/lib/payments/page-cache";
import { reusablePage } from "@/lib/payments/pelecard-page-mapping";
import { canPayOnline, PAYMENTS_CLOSED_MESSAGE } from "@/lib/payments/online-payments";
import { isIntroPackEligible } from "@/lib/plans/eligibility";
import { sameTraineeOrders } from "@/lib/plans/bound-renewal";
import { capturedPriceHolds } from "@/lib/plans/discount";
import { orderManualTerms } from "@/lib/plans/manual-card";
import { maxInstallmentsFor } from "@/lib/plans/installments";
import type { Order, PlanProduct } from "@/types/plans";

export type PaymentPageView = { kind: "frame"; url: string } | { kind: "message"; text: string };

type ProductRow = Pick<
  PlanProduct,
  "id" | "price_ils" | "is_active" | "once_per_trainee" | "staff_terms" | "max_installments"
>;

const INIT_FAILED =
  "לא הצלחנו לפתוח את דף התשלום. נסו שוב בעוד כמה דקות או כתבו לנו בוואטסאפ 052-577-9446.";

const message = (text: string): PaymentPageView => ({ kind: "message", text });

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Opens Pelecard's payment page for one order, after every check the site
 * made before money moved when it still charged cards itself: payments open,
 * rate limits, the order still payable, the product still sellable at the
 * price the order captured, the agreement signed, the intro pack bought only
 * once. The amount and the installment cap always come from the rows.
 */
export async function openPaymentPage(orderId: string, opts: { fresh: boolean }): Promise<PaymentPageView> {
  if (!(await canPayOnline())) return message(PAYMENTS_CLOSED_MESSAGE);

  const db = createAdminClient();
  const { data: order } = (await typedFrom(db, "orders").select("*").eq("id", orderId).maybeSingle()) as {
    data: Order | null;
  };
  if (!order) return message("ההזמנה לא נמצאה");
  if (order.status !== "pending" && order.status !== "expired") return message("ההזמנה בוטלה. התחילו הרשמה חדשה.");

  const [{ data: product }, { count: signed }] = await Promise.all([
    typedFrom(db, "plan_products")
      .select("id, price_ils, is_active, once_per_trainee, staff_terms, max_installments")
      .eq("id", order.product_id)
      .maybeSingle() as unknown as Promise<{ data: ProductRow | null }>,
    // A Payment link's agreement is signed before the card page; the online form signs its own.
    typedFrom(db, "enrollment_agreements")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id)
      .not("signed_at", "is", null) as unknown as Promise<{ count: number | null }>,
  ]);
  if (!product || !sellable(product, order)) return message("המסלול או המחיר השתנו. התחילו הרשמה חדשה.");
  if (!signed) return message("יש לחתום על ההסכם לפני התשלום.");
  if (product.once_per_trainee && !(await introPackStillOpen(db, product, order))) {
    return message("חבילת ההיכרות כבר נרכשה למספר הזה. בחרו מסלול אחר.");
  }

  // A reload shows the page already open; only a new page counts against the limits.
  const reused = reusablePage(await readCachedPage(order.id), Date.now(), opts.fresh);
  if (reused) return { kind: "frame", url: reused };

  const limited = await pageLimitRefusal(order.id);
  if (limited) return message(limited);

  const page = await openPelecardPage({
    id: order.id,
    amountIls: Number(order.amount_ils),
    maxInstallments: maxInstallmentsFor(product, order),
  });
  if (!page.ok) {
    console.error(`[pelecard-page] order ${order.id} init failed: ${page.reason}`);
    return message(INIT_FAILED);
  }
  await rememberPage(order.id, { url: page.url, openedAt: Date.now() });
  return { kind: "frame", url: page.url };
}

/**
 * The limits on opening a new Pelecard page: per IP, and per order so one
 * order cannot become a card-testing tool.
 */
async function pageLimitRefusal(orderId: string): Promise<string | null> {
  const limit = await checkRateLimit(`ip:${await clientIp()}`, "payment");
  waitUntil(limit.pending);
  if (limit.rateLimited) {
    // limit 0 means the limiter itself is unavailable (no Redis).
    return limit.limit === 0
      ? "מערכת התשלום אינה זמינה כרגע. נסו שוב בעוד מספר דקות או כתבו לנו בוואטסאפ."
      : "יותר מדי ניסיונות. נסו שוב בעוד שעה.";
  }
  const orderLimit = await checkRateLimit(`order:${orderId}`, "payment_order");
  waitUntil(orderLimit.pending);
  if (orderLimit.rateLimited) {
    return "יותר מדי ניסיונות תשלום להזמנה הזו. כתבו לנו בוואטסאפ 052-577-9446 ונשלים יחד.";
  }
  return null;
}

/**
 * A manual Card sells its never-active placeholder at the order's own terms;
 * any other product must still be on sale at the price the order captured
 * (a staff Discount keeps its amount).
 */
function sellable(product: ProductRow, order: Order): boolean {
  if (product.staff_terms) return orderManualTerms(order) !== null;
  return (
    product.is_active &&
    capturedPriceHolds(Number(product.price_ils), {
      amountIls: Number(order.amount_ils),
      listPriceIls: order.list_price_ils == null ? null : Number(order.list_price_ils),
    })
  );
}

async function introPackStillOpen(
  db: ReturnType<typeof createAdminClient>,
  product: ProductRow,
  order: Order,
): Promise<boolean> {
  const { count } = await typedFrom(db, "orders")
    .select("id", { count: "exact", head: true })
    .or(sameTraineeOrders(order.login_phone, order.profile_id))
    // A refunded intro pack was still sold; only a Void undoes the sale.
    .in("status", ["paid", "refunded"])
    .eq("product_id", product.id);
  return isIntroPackEligible(product, count ?? 0);
}
