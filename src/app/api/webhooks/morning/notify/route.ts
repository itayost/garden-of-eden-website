import { NextRequest, NextResponse } from "next/server";

/**
 * Morning's notifyUrl. Its body is undocumented, so it is logged and never
 * trusted; the signed webhook at /api/webhooks/morning is the source of truth.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  console.log("[Morning notify]", body.slice(0, 1000));
  return NextResponse.json({ ok: true });
}
