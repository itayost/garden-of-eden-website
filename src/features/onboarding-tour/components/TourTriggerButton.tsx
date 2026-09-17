"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetTour } from "../lib/actions/reset-tour";
import { HelpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TourTriggerButtonProps {
  className?: string;
  /** When used as a dropdown menu item, render without the disabled state */
  asMenuItem?: boolean;
}

export function TourTriggerButton({ className, asMenuItem }: TourTriggerButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await resetTour();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.push("/dashboard?tour=1");
    } catch {
      toast.error("שגיאה בהפעלת הסיור");
    } finally {
      setLoading(false);
    }
  };

  if (asMenuItem) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={className}
        aria-busy={loading}
      >
        {loading ? (
          <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <HelpCircle className="me-2 h-4 w-4" aria-hidden="true" />
        )}
        הפעל סיור מודרך
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="me-2 h-4 w-4 animate-spin" />
      ) : (
        <HelpCircle className="me-2 h-4 w-4" />
      )}
      הפעל סיור מודרך
    </button>
  );
}
