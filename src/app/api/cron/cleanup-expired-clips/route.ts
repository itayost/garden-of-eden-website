import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { CLIPS_BUCKET, CLIP_TTL_DAYS } from "@/lib/api/clip-validation";

/**
 * Vercel Cron Job: Delete trainee clips older than CLIP_TTL_DAYS.
 *
 * Runs daily. Deletes the storage object and the metadata row for any
 * clip whose uploaded_at is older than the TTL window. Per-row failures
 * are logged but do not abort the loop.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[Cleanup Clips] CRON_SECRET env var is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("[Cleanup Clips] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - CLIP_TTL_DAYS * 24 * 60 * 60 * 1000);

  const { data: rows, error: fetchError } = await typedFrom(supabase, "trainee_clips")
    .select("id, storage_path")
    .lt("uploaded_at", cutoff.toISOString());

  if (fetchError) {
    console.error("[Cleanup Clips] fetch error:", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const expired = (rows ?? []) as Array<{ id: string; storage_path: string }>;
  if (expired.length === 0) {
    return NextResponse.json({ success: true, deleted: 0, failed: 0 });
  }

  let deleted = 0;
  let failed = 0;

  for (const row of expired) {
    const { error: storageError } = await supabase.storage
      .from(CLIPS_BUCKET)
      .remove([row.storage_path]);
    if (storageError) {
      console.error(`[Cleanup Clips] storage remove failed for ${row.id}:`, storageError);
      // Continue: still drop the DB row so it doesn't keep matching the cutoff.
    }

    const { error: dbError } = await typedFrom(supabase, "trainee_clips")
      .delete()
      .eq("id", row.id);

    if (dbError) {
      console.error(`[Cleanup Clips] db delete failed for ${row.id}:`, dbError);
      failed++;
      continue;
    }

    deleted++;
  }

  console.log(`[Cleanup Clips] cutoff=${cutoff.toISOString()} deleted=${deleted} failed=${failed}`);
  return NextResponse.json({ success: true, deleted, failed, cutoff: cutoff.toISOString() });
}
