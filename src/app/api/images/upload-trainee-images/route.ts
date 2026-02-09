import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  validateUUID,
  validateImageFile,
  validateProcessedImage,
  generateUniqueFilename,
  getExtensionFromMimeType,
  AVATARS_BUCKET,
  MAX_FILE_SIZE,
  MAX_PROCESSED_SIZE,
} from "@/lib/api/image-validation";
import {
  verifyAdminOrTrainer,
  parseFormDataSafe,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
} from "@/lib/api/auth";
import { uploadAvatarImage, cleanupUploadedFiles } from "@/lib/api/storage";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

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
      return unauthorizedResponse();
    }

    // 1b. Rate limit check
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const identifier = getRateLimitIdentifier(authResult.userId, ip);
    const rateLimitResult = await checkRateLimit(identifier, "general");
    if (rateLimitResult.rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // 2. Parse FormData
    const formData = await parseFormDataSafe(request);
    if (!formData) {
      return badRequestResponse("Invalid form data");
    }

    const original = formData.get("original") as File | null;
    const processed = formData.get("processed") as Blob | null;
    const traineeUserId = formData.get("traineeUserId") as string | null;

    // 3. Validate traineeUserId
    if (!validateUUID(traineeUserId)) {
      return badRequestResponse("Missing or invalid traineeUserId");
    }

    // 4. Validate original image
    const originalValidation = validateImageFile(original, MAX_FILE_SIZE);
    if (!originalValidation.valid) {
      return badRequestResponse(originalValidation.error);
    }

    // 5. Validate processed image
    const processedValidation = validateProcessedImage(processed, MAX_PROCESSED_SIZE);
    if (!processedValidation.valid) {
      return badRequestResponse(processedValidation.error);
    }

    // 6. Upload both images to storage
    const supabase = await createClient();
    const extension = getExtensionFromMimeType(original!.type);
    const originalPath = generateUniqueFilename(traineeUserId, "original", extension);
    const processedPath = generateUniqueFilename(traineeUserId, "processed", "png");

    // Upload original
    const originalResult = await uploadAvatarImage(supabase, originalPath, original!);
    if (!originalResult.success) {
      console.error("[Upload Trainee Images] Original upload error:", originalResult.error);
      return serverErrorResponse("שגיאה בהעלאת התמונה המקורית. נסה שוב.");
    }

    // Upload processed (convert to ArrayBuffer for reliable upload)
    const processedBuffer = await processed!.arrayBuffer();
    const processedResult = await uploadAvatarImage(
      supabase,
      processedPath,
      processedBuffer,
      "image/png"
    );

    if (!processedResult.success) {
      console.error("[Upload Trainee Images] Processed upload error:", processedResult.error);
      // Clean up the original that was already uploaded
      await cleanupUploadedFiles(supabase, AVATARS_BUCKET, [originalPath]);
      return serverErrorResponse("שגיאה בהעלאת התמונה המעובדת. נסה שוב.");
    }

    // 7. Return success with both URLs
    return NextResponse.json({
      originalUrl: originalResult.url,
      processedUrl: processedResult.url,
      originalPath: originalResult.path,
      processedPath: processedResult.path,
    });

  } catch (error) {
    console.error("[Upload Trainee Images] Unexpected error:", error);
    return serverErrorResponse();
  }
}
