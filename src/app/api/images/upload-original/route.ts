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
 * POST /api/images/upload-original
 *
 * Simple image upload for trainee avatars (no background removal).
 *
 * Request body (FormData):
 * - image: File (JPEG or PNG, max 5MB)
 * - traineeUserId: string (UUID of the trainee)
 *
 * Response:
 * - Success: { url: string, path: string }
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

    // 5. Upload image to storage
    const supabase = await createClient();
    const extension = getExtensionFromMimeType(image!.type);
    const imagePath = generateUniqueFilename(traineeUserId, "original", extension);

    const result = await uploadAvatarImage(supabase, imagePath, image!);
    if (!result.success) {
      console.error("[Upload Original] Upload error:", result.error);
      return serverErrorResponse("שגיאה בהעלאת התמונה. נסה שוב.");
    }

    // 6. Return success
    return NextResponse.json({
      url: result.url,
      path: result.path,
    });

  } catch (error) {
    console.error("[Upload Original] Unexpected error:", error);
    return serverErrorResponse();
  }
}
