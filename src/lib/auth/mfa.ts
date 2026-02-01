/**
 * MFA (Multi-Factor Authentication) helper functions
 *
 * Provides a clean abstraction layer over Supabase MFA APIs.
 * All functions return typed results with consistent error handling.
 */

import { createClient } from "@/lib/supabase/client";

// Types
export interface Factor {
  id: string;
  friendlyName: string | null;
  status: "verified" | "unverified";
  createdAt: string;
}

export type EnrollMFAResult =
  | { factorId: string; qrCode: string; secret: string }
  | { error: string };

export type VerifyMFAResult = { success: true } | { error: string };

export type ListFactorsResult = { factors: Factor[] } | { error: string };

export type UnenrollFactorResult = { success: true } | { error: string };

export type GetAALResult =
  | { currentLevel: "aal1" | "aal2"; nextLevel: "aal1" | "aal2" }
  | { error: string };

/**
 * Enroll a new TOTP factor for MFA
 *
 * @param friendlyName - Optional name for the factor (default: "Authenticator App")
 * @returns QR code SVG, secret, and factorId for verification, or error
 */
export async function enrollMFA(
  friendlyName: string = "Authenticator App"
): Promise<EnrollMFAResult> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName,
    });

    if (error) {
      console.error("MFA enroll error:", error);
      return { error: error.message || "Failed to enroll MFA" };
    }

    if (!data) {
      return { error: "No enrollment data returned" };
    }

    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    };
  } catch (error) {
    console.error("MFA enroll exception:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to enroll MFA",
    };
  }
}

/**
 * Verify a TOTP code to complete MFA enrollment or authentication
 *
 * Creates a challenge and then verifies the provided code against it.
 *
 * @param factorId - The factor ID to verify against
 * @param code - The 6-digit TOTP code from authenticator app
 * @returns Success or error
 */
export async function verifyMFA(
  factorId: string,
  code: string
): Promise<VerifyMFAResult> {
  try {
    const supabase = createClient();

    // Step 1: Create a challenge
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });

    if (challengeError) {
      console.error("MFA challenge error:", challengeError);
      return { error: challengeError.message || "Failed to create MFA challenge" };
    }

    if (!challengeData) {
      return { error: "No challenge data returned" };
    }

    // Step 2: Verify the code against the challenge
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      console.error("MFA verify error:", verifyError);
      // Provide user-friendly error message for invalid code
      if (
        verifyError.message?.includes("invalid") ||
        verifyError.message?.includes("expired")
      ) {
        return { error: "Invalid or expired code. Please try again." };
      }
      return { error: verifyError.message || "Failed to verify MFA code" };
    }

    return { success: true };
  } catch (error) {
    console.error("MFA verify exception:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to verify MFA code",
    };
  }
}

/**
 * List all enrolled factors for the current user
 *
 * @returns Array of factors with their details, or error
 */
export async function listFactors(): Promise<ListFactorsResult> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      console.error("MFA listFactors error:", error);
      return { error: error.message || "Failed to list MFA factors" };
    }

    if (!data) {
      return { factors: [] };
    }

    // Map to our Factor type, filtering only TOTP factors
    const factors: Factor[] = data.totp.map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name ?? null,
      status: factor.status as "verified" | "unverified",
      createdAt: factor.created_at,
    }));

    return { factors };
  } catch (error) {
    console.error("MFA listFactors exception:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to list MFA factors",
    };
  }
}

/**
 * Unenroll (remove) a factor
 *
 * After unenrolling, refreshes the session to downgrade AAL level.
 *
 * @param factorId - The factor ID to remove
 * @returns Success or error
 */
export async function unenrollFactor(
  factorId: string
): Promise<UnenrollFactorResult> {
  try {
    const supabase = createClient();

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId,
    });

    if (unenrollError) {
      console.error("MFA unenroll error:", unenrollError);
      return { error: unenrollError.message || "Failed to unenroll MFA factor" };
    }

    // Refresh session to update AAL level
    const { error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError) {
      // Log but don't fail - unenroll succeeded
      console.error("Session refresh after unenroll error:", refreshError);
    }

    return { success: true };
  } catch (error) {
    console.error("MFA unenroll exception:", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to unenroll MFA factor",
    };
  }
}

/**
 * Get the current Authenticator Assurance Level (AAL)
 *
 * - aal1: Single factor authentication (password/phone)
 * - aal2: Two-factor authentication verified this session
 *
 * @returns Current and next required AAL levels, or error
 */
export async function getAAL(): Promise<GetAALResult> {
  try {
    const supabase = createClient();

    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) {
      console.error("MFA getAAL error:", error);
      return { error: error.message || "Failed to get authentication level" };
    }

    if (!data) {
      return { error: "No AAL data returned" };
    }

    return {
      currentLevel: data.currentLevel as "aal1" | "aal2",
      nextLevel: data.nextLevel as "aal1" | "aal2",
    };
  } catch (error) {
    console.error("MFA getAAL exception:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to get authentication level",
    };
  }
}
