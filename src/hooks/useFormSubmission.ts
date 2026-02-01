"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { insertIntoTable } from "@/lib/supabase/helpers";
import { toast } from "sonner";

interface UseFormSubmissionOptions<TFormData> {
  /** Table name in Supabase */
  tableName: string;
  /** Success message to show in toast */
  successMessage: string;
  /** Path to redirect after successful submission */
  redirectPath: string;
  /** Transform form data before submission. Returns the data to insert into the database. */
  transformData?: (data: TFormData, userId: string) => Promise<Record<string, unknown>> | Record<string, unknown>;
  /** Optional callback on success (e.g., clear draft) */
  onSuccess?: () => void;
}

interface UseFormSubmissionResult<TFormData> {
  /** Loading state during submission */
  loading: boolean;
  /** Submit handler to use with form.handleSubmit */
  onSubmit: (data: TFormData) => Promise<void>;
}

/**
 * Hook for handling form submissions to Supabase
 * Provides consistent error handling, loading states, and success flow
 */
export function useFormSubmission<TFormData>({
  tableName,
  successMessage,
  redirectPath,
  transformData,
  onSuccess,
}: UseFormSubmissionOptions<TFormData>): UseFormSubmissionResult<TFormData> {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = useCallback(async (data: TFormData) => {
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("נא להתחבר מחדש");
      }

      // Transform data if transformer provided, otherwise use as-is with user_id
      const submissionData: Record<string, unknown> = transformData
        ? await transformData(data, user.id)
        : { user_id: user.id, ...(data as Record<string, unknown>) };

      // Insert into table using centralized helper for dynamic table names
      const { error } = await insertIntoTable(supabase, tableName, submissionData);

      if (error) throw error;

      // Call success callback (e.g., clear draft)
      onSuccess?.();

      toast.success(successMessage);
      router.push(redirectPath);
    } catch (error: unknown) {
      console.error(`[${tableName}] Submit error:`, error);
      const errorMessage = error instanceof Error ? error.message : "שגיאה בשליחת השאלון";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [tableName, successMessage, redirectPath, transformData, onSuccess, router]);

  return { loading, onSubmit };
}

/**
 * Helper to fetch user profile data
 */
export async function fetchUserProfile(userId: string): Promise<{
  full_name: string | null;
  birthdate: string | null;
} | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, birthdate")
    .eq("id", userId)
    .single();

  return data as { full_name: string | null; birthdate: string | null } | null;
}

/**
 * Helper to calculate age from birthdate
 */
export function calculateAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
