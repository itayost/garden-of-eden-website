import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  verifyAdminOrTrainer,
  parseFormDataSafe,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
} from "@/lib/api/auth";
import { uploadToStorage } from "@/lib/api/storage";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { isValidUUID } from "@/lib/validations/common";

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB
const STORAGE_BUCKET = "avatars";

/**
 * POST /api/nutrition/upload-pdf
 *
 * Upload a meal plan PDF for a trainee.
 *
 * Request body (FormData):
 * - pdf: File (PDF, max 10MB)
 * - traineeUserId: string (UUID of the trainee)
 *
 * Response:
 * - Success: { pdfUrl, pdfPath }
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

    const pdf = formData.get("pdf") as File | null;
    const traineeUserId = formData.get("traineeUserId") as string | null;

    // 3. Validate traineeUserId
    if (!traineeUserId || !isValidUUID(traineeUserId)) {
      return badRequestResponse("Missing or invalid traineeUserId");
    }

    // 3b. Verify trainee exists
    const supabase = await createClient();
    const { data: targetTrainee } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", traineeUserId)
      .single();

    if (!targetTrainee) {
      return badRequestResponse("חניך לא נמצא");
    }

    // 4. Validate PDF file
    if (!pdf || !(pdf instanceof File)) {
      return badRequestResponse("Missing PDF file");
    }

    if (pdf.type !== "application/pdf") {
      return badRequestResponse("הקובץ חייב להיות PDF");
    }

    if (pdf.size > MAX_PDF_SIZE) {
      return badRequestResponse("הקובץ גדול מדי. מקסימום 10MB");
    }

    // 5. Upload PDF to storage
    const timestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const pdfPath = `${traineeUserId}/meal-plan/${timestamp}.pdf`;

    const uploadResult = await uploadToStorage(
      supabase,
      STORAGE_BUCKET,
      pdfPath,
      pdf,
      { contentType: "application/pdf" }
    );

    if (!uploadResult.success) {
      console.error("[Upload Nutrition PDF] Upload error:", uploadResult.error);
      return serverErrorResponse("שגיאה בהעלאת הקובץ. נסה שוב.");
    }

    // 6. Return success
    return NextResponse.json({
      pdfUrl: uploadResult.url,
      pdfPath: uploadResult.path,
    });
  } catch (error) {
    console.error("[Upload Nutrition PDF] Unexpected error:", error);
    return serverErrorResponse();
  }
}
