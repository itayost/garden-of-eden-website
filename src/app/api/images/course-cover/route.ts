import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFormDataSafe, verifyAdmin } from "@/lib/api/auth";
import { validateUUID } from "@/lib/api/image-validation";
import { uploadAvatarImage } from "@/lib/api/storage";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import {
  coverFileProblem,
  coverStoragePath,
} from "@/features/course/lib/course-cover-rules";

type CoverResponse = { success: true; url: string } | { success: false; error: string };

function fail(error: string, status: number) {
  return NextResponse.json<CoverResponse>({ success: false, error }, { status });
}

/**
 * POST /api/images/course-cover
 *
 * Admin-only upload of a course cover image.
 * FormData: file (JPEG, PNG or WebP, up to 4 MB: Vercel refuses a body over
 * 4.5 MB before this runs, and the browser compresses first), courseId (UUID).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) return fail("אין הרשאה", 403);

    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const limit = await checkRateLimit(
      getRateLimitIdentifier(auth.userId, ip),
      "general"
    );
    if (limit.rateLimited) return fail("יותר מדי בקשות. נסה שוב בעוד רגע.", 429);

    const formData = await parseFormDataSafe(request);
    if (!formData) return fail("הבקשה לא תקינה", 400);

    const file = formData.get("file");
    const courseId = formData.get("courseId");
    if (typeof courseId !== "string" || !validateUUID(courseId)) {
      return fail("מזהה קורס לא תקין", 400);
    }
    if (!(file instanceof File)) return fail("לא נבחרה תמונה", 400);
    const problem = coverFileProblem(file);
    if (problem) return fail(problem, 400);

    const db = createAdminClient();
    const path = coverStoragePath(courseId, Date.now(), file.type);
    const result = await uploadAvatarImage(db, path, file, file.type);
    if (!result.success) {
      console.error("[Course cover] Upload error:", result.error);
      return fail("שגיאה בהעלאת התמונה. נסה שוב.", 500);
    }

    return NextResponse.json<CoverResponse>({ success: true, url: result.url });
  } catch (error) {
    console.error("[Course cover] Unexpected error:", error);
    return fail("שגיאה בהעלאת התמונה. נסה שוב.", 500);
  }
}
