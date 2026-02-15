/**
 * Shared authentication utilities for API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin as verifyAdminShared, verifyAdminOrTrainer as verifyAdminOrTrainerShared } from "@/lib/actions/shared/verify-admin";

type AuthResult =
  | { authorized: true; userId: string }
  | { authorized: false; userId: null };

/**
 * Verify current user is authenticated and has admin or trainer role
 */
export async function verifyAdminOrTrainer(): Promise<AuthResult> {
  const result = await verifyAdminOrTrainerShared();
  if (result.error) return { authorized: false, userId: null };
  return { authorized: true, userId: result.user!.id };
}

/**
 * Verify current user is authenticated and has admin role only
 */
export async function verifyAdmin(): Promise<AuthResult> {
  const result = await verifyAdminShared();
  if (result.error) return { authorized: false, userId: null };
  return { authorized: true, userId: result.user!.id };
}

/**
 * Parse FormData safely from request
 * Returns null if parsing fails
 */
export async function parseFormDataSafe(
  request: NextRequest
): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

/**
 * Create standard unauthorized response
 */
export function unauthorizedResponse(message = "Unauthorized - Admin or trainer role required") {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Create standard bad request response
 */
export function badRequestResponse(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * Create standard server error response
 */
export function serverErrorResponse(error = "Internal server error") {
  return NextResponse.json({ error }, { status: 500 });
}
