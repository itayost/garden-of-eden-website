import { NextRequest, NextResponse } from "next/server";
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
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

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

    // 8. Process with remove.bg via direct API call (JSON body for base64 input)
    const removeBgResponse = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        image_file_b64: imageBase64,
        size: "regular",
        type: "person",
        format: "png",
      }),
    });

    if (!removeBgResponse.ok) {
      if (removeBgResponse.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later" },
          { status: 429 }
        );
      }
      const errorBody = await removeBgResponse.text();
      console.error("[Process Background] remove.bg error:", removeBgResponse.status, errorBody);
      return serverErrorResponse("Failed to remove background from image");
    }

    // 9. Upload processed image (API returns base64 in JSON when Accept: application/json)
    const removeBgData = await removeBgResponse.json();
    const resultBase64: unknown = removeBgData?.data?.result_b64;
    if (typeof resultBase64 !== "string") {
      console.error("[Process Background] Unexpected remove.bg response shape:", JSON.stringify(removeBgData).slice(0, 500));
      return serverErrorResponse("Failed to remove background from image");
    }
    const processedBuffer = Buffer.from(resultBase64, "base64");
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
