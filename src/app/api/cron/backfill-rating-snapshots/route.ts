// src/app/api/cron/backfill-rating-snapshots/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeRatingSnapshot } from "@/features/player-assessments/lib/snapshot";
import { grantAssessmentBadges } from "@/features/achievements/lib/actions/grant-assessment-badges";
import type { PlayerAssessment } from "@/types/assessment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily orphan-snapshot catcher.
 * Finds assessments without a corresponding snapshot row and computes one.
 * Also grants any retroactive badges (preCelebrated=true).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const [{ data: assessments, error }, { data: snapshotIds, error: sErr }] =
    await Promise.all([
      supabase.from("player_assessments").select("*").is("deleted_at", null),
      supabase
        .from("player_rating_snapshots")
        .select("assessment_id")
        .is("deleted_at", null),
    ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const known = new Set((snapshotIds ?? []).map((r) => r.assessment_id));
  const missing = ((assessments ?? []) as PlayerAssessment[]).filter(
    (a) => !known.has(a.id)
  );
  if (missing.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, found: 0 });
  }

  // Batch-fetch birthdates for every distinct user once, instead of one
  // round-trip per orphan assessment.
  const userIds = Array.from(new Set(missing.map((a) => a.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, birthdate")
    .in("id", userIds);
  const birthdateByUser = new Map<string, string | null>();
  for (const p of (profiles ?? []) as { id: string; birthdate: string | null }[]) {
    birthdateByUser.set(p.id, p.birthdate);
  }

  let processed = 0;
  for (const a of missing) {
    const birthdate = birthdateByUser.get(a.user_id) ?? null;
    const result = await writeRatingSnapshot(supabase, a, birthdate);
    if (result.ok) {
      await grantAssessmentBadges(supabase, a, { preCelebrated: true });
      processed++;
    }
  }
  return NextResponse.json({ ok: true, processed, found: missing.length });
}
