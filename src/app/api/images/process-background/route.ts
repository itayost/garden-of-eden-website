import { NextRequest, NextResponse } from "next/server";
import { removeBackgroundFromImageBase64 } from "remove.bg";
import { createClient } from "@/lib/supabase/server";
import {
  validateUUID,
  validateImageFile,
  generateUniqueFilename,
  getExtensionFromMimeType,
  MAX_FILE_SIZE,
} from "@/lib/api/image-validation";
import {
  verifyAdminOrTrainer,
  parseFormDataSafe,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
} from "@/lib/api/auth";
import { uploadAvatarImage } from "@/lib/api/storage";

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
      return unauthorizedResponse();
    }

    // 2. Parse FormData
    const formData = await parseFormDataSafe(request);
    if (!formData) {
      return badRequestResponse("Invalid form data");
    }

    const image = formData.get("image") as File | null;
    const traineeUserId = formData.get("traineeUserId") as string | null;

    // 3. Validate traineeUserId
    if (!validateUUID(traineeUserId)) {
      return badRequestResponse("Missing or invalid traineeUserId");
    }

    // 4. Validate image
    const imageValidation = validateImageFile(image, MAX_FILE_SIZE);
    if (!imageValidation.valid) {
      return badRequestResponse(imageValidation.error);
    }

    // 5. Upload original image to storage
    const supabase = await createClient();
    const extension = getExtensionFromMimeType(image!.type);
    const originalPath = generateUniqueFilename(traineeUserId, "original", extension);

    const originalResult = await uploadAvatarImage(supabase, originalPath, image!);
    if (!originalResult.success) {
      console.error("[Process Background] Original upload error:", originalResult.error);
      return serverErrorResponse("שגיאה בהעלאת התמונה. נסה שוב.");
    }

    // 6. Convert image to base64 for remove.bg
    const imageArrayBuffer = await image!.arrayBuffer();
    const imageBase64 = Buffer.from(imageArrayBuffer).toString("base64");

    // 7. Check for API key
    const apiKey = process.env.REMOVEBG_API_KEY;
    if (!apiKey) {
      console.error("[Process Background] REMOVEBG_API_KEY not configured");
      return serverErrorResponse("Background removal service not configured");
    }

    // 8. Process with remove.bg
    let processedBase64: string;
    try {
      const result = await removeBackgroundFromImageBase64({
        base64img: imageBase64,
        apiKey,
        size: "regular",
        type: "person",
        format: "png",
        outputFile: undefined,
      });
      processedBase64 = result.base64img;
    } catch (removeBgError: unknown) {
      console.error("[Process Background] remove.bg error:", removeBgError);

      const errorMessage = removeBgError instanceof Error ? removeBgError.message : String(removeBgError);
      if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later" },
          { status: 429 }
        );
      }

      return serverErrorResponse("Failed to remove background from image");
    }

    // 9. Upload processed image
    const processedBuffer = Buffer.from(processedBase64, "base64");
    const processedPath = generateUniqueFilename(traineeUserId, "processed", "png");

    const processedResult = await uploadAvatarImage(
      supabase,
      processedPath,
      processedBuffer,
      "image/png"
    );

    if (!processedResult.success) {
      console.error("[Process Background] Processed upload error:", processedResult.error);
      return serverErrorResponse("שגיאה בהעלאת התמונה המעובדת. נסה שוב.");
    }

    // 10. Return success with both URLs
    return NextResponse.json({
      originalUrl: originalResult.url,
      processedUrl: processedResult.url,
      originalPath: originalResult.path,
      processedPath: processedResult.path,
    });

  } catch (error) {
    console.error("[Process Background] Unexpected error:", error);
    return serverErrorResponse();
  }
}
