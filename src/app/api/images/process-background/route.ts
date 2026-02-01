import { NextRequest, NextResponse } from "next/server";
import { removeBackgroundFromImageBase64 } from "remove.bg";
import { createClient } from "@/lib/supabase/server";

const AVATARS_BUCKET = "avatars";
const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allowed file types (JPEG, PNG only per CONTEXT.md)
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];

// Max file size: 5MB per CONTEXT.md
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
 * POST /api/images/process-background
 *
 * Receives an image, removes its background using remove.bg,
 * stores both original and processed versions, and returns URLs.
 *
 * Request body (FormData):
 * - image: File (JPEG or PNG, max 5MB)
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

    const image = formData.get("image") as File | null;
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

    // 4. Validate image exists
    if (!image || !(image instanceof File)) {
      return NextResponse.json(
        { error: "Missing image file" },
        { status: 400 }
      );
    }

    // 5. Validate image type (JPEG, PNG only)
    if (!ALLOWED_MIME_TYPES.includes(image.type)) {
      return NextResponse.json(
        { error: "Invalid image format. Only JPEG and PNG are allowed" },
        { status: 400 }
      );
    }

    // 6. Validate image size (max 5MB)
    if (image.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // 7. Upload original image to storage using server client
    const supabase = await createClient();
    const extension = EXTENSION_MAP[image.type] || "jpg";
    const timestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const originalPath = `${traineeUserId}/original/${timestamp}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(originalPath, image, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("[Process Background] Original upload error:", uploadError);
      return NextResponse.json(
        { error: "שגיאה בהעלאת התמונה. נסה שוב." },
        { status: 500 }
      );
    }

    const { data: originalUrlData } = supabase.storage
      .from(AVATARS_BUCKET)
      .getPublicUrl(originalPath);

    // 8. Convert image to base64 for remove.bg
    const imageArrayBuffer = await image.arrayBuffer();
    const imageBase64 = Buffer.from(imageArrayBuffer).toString("base64");

    // 9. Check for API key
    const apiKey = process.env.REMOVEBG_API_KEY;
    if (!apiKey) {
      console.error("[Process Background] REMOVEBG_API_KEY not configured");
      return NextResponse.json(
        { error: "Background removal service not configured" },
        { status: 500 }
      );
    }

    // 10. Process with remove.bg
    let processedBase64: string;
    try {
      const result = await removeBackgroundFromImageBase64({
        base64img: imageBase64,
        apiKey,
        size: "regular",
        type: "person",
        format: "png",
        outputFile: undefined, // We don't want to write to file
      });

      // result.base64img contains the processed image as base64
      processedBase64 = result.base64img;
    } catch (removeBgError: unknown) {
      console.error("[Process Background] remove.bg error:", removeBgError);

      // Handle rate limit error
      const errorMessage = removeBgError instanceof Error ? removeBgError.message : String(removeBgError);
      if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later" },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Failed to remove background from image" },
        { status: 500 }
      );
    }

    // 11. Convert processed base64 back to Buffer
    const processedBuffer = Buffer.from(processedBase64, "base64");

    // 12. Upload processed image to storage using server client
    const processedTimestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const processedPath = `${traineeUserId}/processed/${processedTimestamp}.png`;

    const { error: processedUploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(processedPath, processedBuffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/png",
      });

    if (processedUploadError) {
      console.error("[Process Background] Processed upload error:", processedUploadError);
      return NextResponse.json(
        { error: "שגיאה בהעלאת התמונה המעובדת. נסה שוב." },
        { status: 500 }
      );
    }

    const { data: processedUrlData } = supabase.storage
      .from(AVATARS_BUCKET)
      .getPublicUrl(processedPath);

    // 13. Return success with both URLs
    return NextResponse.json({
      originalUrl: originalUrlData.publicUrl,
      processedUrl: processedUrlData.publicUrl,
      originalPath: originalPath,
      processedPath: processedPath,
    });

  } catch (error) {
    console.error("[Process Background] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
