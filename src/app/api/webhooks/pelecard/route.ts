import { NextResponse, type NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { feedbackIds } from "@/lib/payments/pelecard-page-mapping";
import { settlePagePayment } from "@/features/enrollment/lib/settle-page-payment";

export const dynamic = "force-dynamic";

const RECEIVED = { received: true };

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Pelecard's server-side result for a payment page (ServerSideGoodFeedbackURL
 * and ServerSideErrorFeedbackURL), so a payment sticks even when the parent
 * closes the tab before the redirect. The body is only read for the order id
 * and the transaction id; settlePagePayment confirms the payment with
 * Pelecard before anything changes. Always answers 200, and never logs the
 * body.
 */
export async function POST(request: NextRequest) {
  const limit = await checkRateLimit(`ip:${clientIp(request)}`, "payment_feedback");
  waitUntil(limit.pending);
  if (limit.rateLimited) {
    console.warn("[pelecard-callback] rate limited, not settled");
    return NextResponse.json(RECEIVED);
  }

  const ids = feedbackIds(await request.text());
  if (!ids.orderId || !ids.transactionId) {
    console.warn("[pelecard-callback] ignored: no order id or transaction id");
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
