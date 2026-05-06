import { NextRequest, NextResponse } from "next/server";
import { dispatchPendingWelcomes } from "@/lib/whatsapp/dispatch-pending-welcomes";

/**
 * Vercel Cron Job: Send pending Arbox welcome messages.
 *
 * Runs daily at 06:00 UTC (~09:00 Israel summer / ~08:00 winter).
 * Picks up profiles created by the nightly arbox-sync that still have
 * welcome_message_sent_at = NULL and dispatches the Hebrew template.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[Welcome Dispatch] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.WHATSAPP_WELCOME_TEMPLATE_NAME) {
    console.warn(
      "[Welcome Dispatch] WHATSAPP_WELCOME_TEMPLATE_NAME not set — skipping run"
    );
    return NextResponse.json({ success: true, skipped: "template not configured" });
  }

  try {
    const result = await dispatchPendingWelcomes();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Welcome Dispatch] Fatal error:", error);
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }
}
