import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { buildRetentionReport } from "@/lib/arbox/retention";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[Retention Report] CRON_SECRET env var is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ARBOX_API_KEY) {
    console.error("[Retention Report] ARBOX_API_KEY env var is not set");
    return NextResponse.json(
      { error: "ARBOX_API_KEY not configured" },
      { status: 500 },
    );
  }

  try {
    // Determine report month (1st of current month)
    const now = new Date();
    const reportMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    console.log(`[Retention Report] Building report for ${reportMonth}`);

    const data = await buildRetentionReport(reportMonth);

    const totalEntries =
      data.monthly.length + data.pro.length + data.training_card.length;
    console.log(
      `[Retention Report] Found ${totalEntries} expiring memberships (monthly: ${data.monthly.length}, pro: ${data.pro.length}, training_card: ${data.training_card.length})`,
    );

    // Upsert into Supabase
    const supabase = createAdminClient();
    const { error } = await typedFrom(supabase, "retention_reports").upsert(
      {
        report_month: reportMonth,
        data: data as unknown as Record<string, unknown>,
      },
      { onConflict: "report_month" },
    );

    if (error) {
      console.error("[Retention Report] Supabase upsert error:", error);
      return NextResponse.json(
        { error: "Failed to save report" },
        { status: 500 },
      );
    }

    console.log(`[Retention Report] Saved report for ${reportMonth}`);

    return NextResponse.json({
      success: true,
      report_month: reportMonth,
      counts: {
        monthly: data.monthly.length,
        pro: data.pro.length,
        training_card: data.training_card.length,
      },
    });
  } catch (error) {
    console.error("[Retention Report] Fatal error:", error);
    return NextResponse.json(
      { error: "Report generation failed" },
      { status: 500 },
    );
  }
}
