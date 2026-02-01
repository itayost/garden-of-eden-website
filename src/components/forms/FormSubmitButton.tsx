"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";

interface FormSubmitButtonProps {
  loading: boolean;
  label?: string;
  loadingLabel?: string;
  className?: string;
}

/**
 * Submit button with loading state for forms
 */
export function FormSubmitButton({
  loading,
  label = "שליחת השאלון",
  loadingLabel = "שולח...",
  className = "w-full",
}: FormSubmitButtonProps) {
  return (
    <Button type="submit" className={className} size="lg" disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="ml-2 h-5 w-5 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          <Send className="ml-2 h-5 w-5" />
          {label}
        </>
      )}
    </Button>
  );
}
