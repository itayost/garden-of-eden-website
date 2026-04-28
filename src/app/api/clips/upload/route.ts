import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { typedFrom, upsertIntoTable } from "@/lib/supabase/helpers";
import {
  badRequestResponse,
  parseFormDataSafe,
  serverErrorResponse,
} from "@/lib/api/auth";
import { cleanupUploadedFiles, uploadToStorage } from "@/lib/api/storage";
import {
  buildClipPath,
  CLIPS_BUCKET,
  validateClipFile,
} from "@/lib/api/clip-validation";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    }

    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimit = await checkRateLimit(
      getRateLimitIdentifier(user.id, ip),
      "general",
    );
    if (rateLimit.rateLimited) {
      return NextResponse.json(
        { error: "יותר מדי בקשות, נסו שוב בעוד רגע" },
        { status: 429 },
      );
    }

    const formData = await parseFormDataSafe(request);
    if (!formData) return badRequestResponse("בקשה לא תקינה");

    const file = formData.get("file") as File | null;
    const validation = validateClipFile(file);
    if (!validation.valid) return badRequestResponse(validation.error);

    const path = buildClipPath(user.id, file!.type);
    const upload = await uploadToStorage(supabase, CLIPS_BUCKET, path, file!, {
      contentType: file!.type,
      upsert: false,
    });

    if (!upload.success) {
      console.error("[Clips Upload] upload error:", upload.error);
      return serverErrorResponse("שגיאה בהעלאת הסרטון. נסו שוב.");
    }

    const { data: existing } = await typedFrom(supabase, "trainee_clips")
      .select("storage_path")
      .eq("user_id", user.id)
      .maybeSingle();

    const { error: dbError } = await upsertIntoTable(supabase, "trainee_clips", {
      user_id: user.id,
      storage_path: upload.path,
      mime_type: file!.type,
      size_bytes: file!.size,
      uploaded_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error("[Clips Upload] db error:", dbError);
      await cleanupUploadedFiles(supabase, CLIPS_BUCKET, [upload.path]);
      return serverErrorResponse("שגיאה בשמירת הסרטון. נסו שוב.");
    }

    if (existing?.storage_path && existing.storage_path !== upload.path) {
      await cleanupUploadedFiles(supabase, CLIPS_BUCKET, [
        existing.storage_path as string,
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Clips Upload] unexpected error:", error);
    return serverErrorResponse("שגיאה לא צפויה");
  }
}
