/**
 * Shared authentication utilities for API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AuthResult =
  | { authorized: true; userId: string }
  | { authorized: false; userId: null };

/**
 * Verify current user is authenticated and has admin or trainer role
 */
export async function verifyAdminOrTrainer(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, userId: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "trainer")) {
    return { authorized: false, userId: null };
  }

  return { authorized: true, userId: user.id };
}

/**
 * Verify current user is authenticated and has admin role only
 */
export async function verifyAdmin(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, userId: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { authorized: false, userId: null };
  }

  return { authorized: true, userId: user.id };
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
