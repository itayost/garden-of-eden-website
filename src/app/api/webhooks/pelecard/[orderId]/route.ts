import { NextResponse, type NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { callbackIds } from "@/lib/payments/pelecard-page-mapping";
import { settlePagePayment } from "@/features/enrollment/lib/settle-page-payment";

export const dynamic = "force-dynamic";

const RECEIVED = { received: true };

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

/**
 * Pelecard's server-side result for one order's payment page
 * (ServerSideGoodFeedbackURL and ServerSideErrorFeedbackURL), so a payment
 * sticks even when the parent closes the tab before the redirect. The order
 * comes from the path (Pelecard's result JSON has no UserKey) and the body
 * is only read for the transaction id; settlePagePayment confirms the
 * payment with Pelecard before anything changes. Limited per order, because
 * every callback comes from Pelecard's one address. Always answers 200, and
 * never logs the body.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { orderId } = await context.params;
  const ids = callbackIds(orderId, await request.text());
  if (!ids?.orderId || !ids.transactionId) {
    console.warn(`[pelecard-callback] order ${orderId} ignored: no transaction id, or another order's`);
    return NextResponse.json(RECEIVED);
  }

  const limit = await checkRateLimit(`order:${ids.orderId}`, "payment_feedback");
  waitUntil(limit.pending);
  if (limit.rateLimited) {
    console.warn(`[pelecard-callback] order ${ids.orderId} rate limited, not settled`);
    return NextResponse.json(RECEIVED);
  }

  try {
    const outcome = await settlePagePayment(createAdminClient(), {
      orderId: ids.orderId,
      transactionId: ids.transactionId,
      hintCode: ids.statusCode,
    });
    console.info(`[pelecard-callback] order ${ids.orderId}: ${outcome.kind}`);
  } catch (error) {
    console.error(`[pelecard-callback] order ${ids.orderId} settle threw:`, error instanceof Error ? error.message : error);
  }
  return NextResponse.json(RECEIVED);
}
