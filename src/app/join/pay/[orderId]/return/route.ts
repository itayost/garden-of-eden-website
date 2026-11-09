import { NextResponse, type NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { isValidUUID } from "@/lib/validations/common";
import { callbackIds } from "@/lib/payments/pelecard-page-mapping";
import { forgetPage } from "@/lib/payments/page-cache";
import {
  forgetsOpenPage,
  returnRedirect,
  unverifiedOutcome,
  type SettleOutcome,
} from "@/lib/payments/page-settlement";
import { settlePagePayment } from "@/features/enrollment/lib/settle-page-payment";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Where Pelecard sends the parent's top window when the payment page ends
 * (GoodURL and ErrorURL). Its parameters only say which transaction to ask
 * about; settlePagePayment confirms with Pelecard before anything changes.
 */
async function outcomeFor(request: NextRequest, orderId: string, fields: URLSearchParams | string): Promise<SettleOutcome> {
  const limit = await checkRateLimit(`ip:${clientIp(request)}`, "payment_feedback");
  waitUntil(limit.pending);
  // Too many: send the parent to the confirmation page and let the callback settle it.
  if (limit.rateLimited) return { kind: "unverified" };

  const ids = callbackIds(orderId, fields);
  if (!ids) return { kind: "ignored", reason: "UserKey belongs to another order" };
  if (!ids.transactionId) {
    // Nothing to ask Pelecard about, so the order is not held.
    const hinted = unverifiedOutcome(ids.statusCode);
    return hinted.kind === "unverified" ? { kind: "ignored", reason: "no transaction id" } : hinted;
  }
  try {
    return await settlePagePayment(createAdminClient(), {
      orderId,
      transactionId: ids.transactionId,
      hintCode: ids.statusCode,
    });
  } catch (error) {
    console.error(`[pelecard-return] order ${orderId} settle threw:`, error instanceof Error ? error.message : error);
    return { kind: "unverified" };
  }
}

async function respond(request: NextRequest, context: RouteContext, fields: URLSearchParams | string) {
  const { orderId } = await context.params;
  if (!isValidUUID(orderId)) return NextResponse.redirect(new URL("/join", request.url), 303);
  const outcome = await outcomeFor(request, orderId, fields);
  console.info(`[pelecard-return] order ${orderId}: ${outcome.kind}`);
  // Pelecard ended this page: the card page opens a new one instead of reusing it.
  if (forgetsOpenPage(outcome)) await forgetPage(orderId);
  return NextResponse.redirect(new URL(returnRedirect(outcome, orderId), request.url), 303);
}

export async function GET(request: NextRequest, context: RouteContext) {
  return respond(request, context, request.nextUrl.searchParams);
}

/** Pelecard posts here instead when FeedbackDataTransferMethod is POST. */
export async function POST(request: NextRequest, context: RouteContext) {
  return respond(request, context, await request.text());
}
