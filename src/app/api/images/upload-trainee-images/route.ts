import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const AVATARS_BUCKET = "avatars";
const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allowed file types (JPEG, PNG only)
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];

// Max file size: 5MB for original, 10MB for processed (PNG can be larger)
const MAX_ORIGINAL_SIZE = 5 * 1024 * 1024;
const MAX_PROCESSED_SIZE = 10 * 1024 * 1024;

/**
 * Verify current user is authenticated and has admin or trainer role
 */
async function verifyAdminOrTrainer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false as const, userId: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "trainer")) {
    return { authorized: false as const, userId: null };
  }

  return { authorized: true as const, userId: user.id };
}

/**
 * POST /api/images/upload-trainee-images
 *
 * Receives both original and processed (background-removed) images
 * and uploads them to storage. Processing is done client-side.
 *
 * Request body (FormData):
 * - original: File (JPEG or PNG, max 5MB)
 * - processed: File (PNG with transparency, max 10MB)
 * - traineeUserId: string (UUID of the trainee)
 *
 * Response:
 * - Success: { originalUrl, processedUrl, originalPath, processedPath }
 * - Error: { error: string }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin/trainer role
    const authResult = await verifyAdminOrTrainer();
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: "Unauthorized - Admin or trainer role required" },
        { status: 403 }
      );
    }

    // 2. Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid form data" },
        { status: 400 }
      );
    }

    const original = formData.get("original") as File | null;
    const processed = formData.get("processed") as File | null;
    const traineeUserId = formData.get("traineeUserId") as string | null;

    // 3. Validate traineeUserId
    if (!traineeUserId) {
      return NextResponse.json(
        { error: "Missing traineeUserId" },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(traineeUserId)) {
      return NextResponse.json(
        { error: "Invalid traineeUserId format" },
        { status: 400 }
      );
    }

    // 4. Validate original image
    if (!original || !(original instanceof File)) {
      return NextResponse.json(
        { error: "Missing original image file" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(original.type)) {
      return NextResponse.json(
        { error: "Invalid original image format. Only JPEG and PNG are allowed" },
        { status: 400 }
      );
    }

    if (original.size > MAX_ORIGINAL_SIZE) {
      return NextResponse.json(
        { error: "Original image too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // 5. Validate processed image
    if (!processed || !(processed instanceof File)) {
      return NextResponse.json(
        { error: "Missing processed image file" },
        { status: 400 }
      );
    }

    // Processed should be PNG (for transparency)
    if (processed.type !== "image/png") {
      return NextResponse.json(
        { error: "Processed image must be PNG format" },
        { status: 400 }
      );
    }

    if (processed.size > MAX_PROCESSED_SIZE) {
      return NextResponse.json(
        { error: "Processed image too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // 6. Upload both images to storage
    const supabase = await createClient();
    const timestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Upload original
    const originalExtension = EXTENSION_MAP[original.type] || "jpg";
    const originalPath = `${traineeUserId}/original/${timestamp}.${originalExtension}`;

    const { error: originalUploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(originalPath, original, {
        cacheControl: "3600",
        upsert: false,
      });

    if (originalUploadError) {
      console.error("[Upload Trainee Images] Original upload error:", originalUploadError);
      return NextResponse.json(
        { error: "שגיאה בהעלאת התמונה המקורית. נסה שוב." },
        { status: 500 }
      );
    }

    // Upload processed
    const processedPath = `${traineeUserId}/processed/${timestamp}.png`;

    const { error: processedUploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(processedPath, processed, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/png",
      });

    if (processedUploadError) {
      console.error("[Upload Trainee Images] Processed upload error:", processedUploadError);
      // Try to clean up the original that was already uploaded
      await supabase.storage.from(AVATARS_BUCKET).remove([originalPath]);
      return NextResponse.json(
        { error: "שגיאה בהעלאת התמונה המעובדת. נסה שוב." },
        { status: 500 }
      );
    }

    // 7. Get public URLs
    const { data: originalUrlData } = supabase.storage
      .from(AVATARS_BUCKET)
      .getPublicUrl(originalPath);

    const { data: processedUrlData } = supabase.storage
      .from(AVATARS_BUCKET)
      .getPublicUrl(processedPath);

    // 8. Return success with both URLs
    return NextResponse.json({
      originalUrl: originalUrlData.publicUrl,
      processedUrl: processedUrlData.publicUrl,
      originalPath: originalPath,
      processedPath: processedPath,
    });

  } catch (error) {
    console.error("[Upload Trainee Images] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
