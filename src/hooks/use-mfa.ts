"use client";

/**
 * useMFA - React hook for MFA state management
 *
 * Provides reactive state for MFA status including:
 * - Whether user has MFA enabled (verified TOTP factor)
 * - Whether current session needs MFA verification (aal1 -> aal2)
 * - List of enrolled factors
 */

import { useState, useEffect, useCallback } from "react";
import {
  listFactors,
  getAAL,
  type Factor,
} from "@/lib/auth/mfa";

export interface UseMFAReturn {
  /** User has at least one verified TOTP factor */
  hasMFA: boolean;
  /** User has MFA but hasn't verified this session (aal1 -> aal2) */
  needsVerification: boolean;
  /** List of enrolled factors */
  factors: Factor[];
  /** Loading state during async operations */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Re-fetch factors and AAL (use after enrollment/unenrollment) */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing MFA state
 *
 * Usage:
 * ```tsx
 * const { hasMFA, needsVerification, factors, isLoading, refresh } = useMFA();
 *
 * if (needsVerification) {
 *   return <MFAVerifyForm />;
 * }
 *
 * if (!hasMFA) {
 *   return <MFAEnrollButton />;
 * }
 * ```
 */
export function useMFA(): UseMFAReturn {
  const [hasMFA, setHasMFA] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMFAStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch factors and AAL in parallel
      const [factorsResult, aalResult] = await Promise.all([
        listFactors(),
        getAAL(),
      ]);

      // Handle factors result
      if ("error" in factorsResult) {
        setError(factorsResult.error);
        setFactors([]);
        setHasMFA(false);
      } else {
        setFactors(factorsResult.factors);
        // User has MFA if they have at least one verified TOTP factor
        const hasVerifiedFactor = factorsResult.factors.some(
          (factor) => factor.status === "verified"
        );
        setHasMFA(hasVerifiedFactor);
      }

      // Handle AAL result
      if ("error" in aalResult) {
        // If AAL fetch fails, we can still use factors data
        // Don't override the error if factors also failed
        if (!("error" in factorsResult)) {
          setError(aalResult.error);
        }
        setNeedsVerification(false);
      } else {
        // User needs verification if:
        // - Current level is aal1 (single factor)
        // - Next level is aal2 (MFA required)
        // This means user has MFA set up but hasn't verified this session
        setNeedsVerification(
          aalResult.currentLevel === "aal1" && aalResult.nextLevel === "aal2"
        );
      }
    } catch (err) {
      console.error("useMFA fetch error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch MFA status"
      );
      setHasMFA(false);
      setNeedsVerification(false);
      setFactors([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchMFAStatus();
  }, [fetchMFAStatus]);

  return {
    hasMFA,
    needsVerification,
    factors,
    isLoading,
    error,
    refresh: fetchMFAStatus,
  };
}
