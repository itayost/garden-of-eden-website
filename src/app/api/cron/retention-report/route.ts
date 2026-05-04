import { NextRequest, NextResponse } from "next/server";
import { persistRetentionReport } from "@/lib/arbox/persist-retention-report";

export const maxDuration = 300;

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
    const now = new Date();
    const reportMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    console.log(`[Retention Report] Building report for ${reportMonth}`);

    const { data, refreshedAt } = await persistRetentionReport(reportMonth);

    const totalEntries =
      data.monthly.length + data.pro.length + data.training_card.length;
    console.log(
      `[Retention Report] Saved ${totalEntries} entries for ${reportMonth} (monthly: ${data.monthly.length}, pro: ${data.pro.length}, training_card: ${data.training_card.length})`,
    );

    return NextResponse.json({
      success: true,
      report_month: reportMonth,
      refreshed_at: refreshedAt,
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
