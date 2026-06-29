"use client";

import { useState, useTransition } from "react";
import { Check, Circle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toggleDrillDone } from "@/features/development-book/lib/actions/book-drill-progress";

interface DrillDoneToggleProps {
  drillId: string;
  initialDone: boolean;
}

export function DrillDoneToggle({ drillId, initialDone }: DrillDoneToggleProps) {
  const [done, setDone] = useState(initialDone);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const optimisticDone = !done;
    setDone(optimisticDone);

    startTransition(async () => {
      const result = await toggleDrillDone(drillId);

      if (!result.success) {
        // Rollback on failure
        setDone(!optimisticDone);
        toast.error(result.error ?? "הפעולה נכשלה, נסה שוב");
        return;
      }

      // Sync server truth (should match optimistic in most cases)
      setDone(result.done);

      if (result.done) {
        toast.success("תרגיל סומן כהושלם");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={done}
      aria-label={done ? "בטל סימון תרגיל כהושלם" : "סמן תרגיל כהושלם"}
      className={cn(
        "shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center",
        "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        done
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted bg-transparent text-transparent hover:border-primary/60",
        isPending && "opacity-50 cursor-not-allowed"
      )}
    >
      {done ? (
        <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
      ) : (
        <Circle className="w-3 h-3 opacity-0" aria-hidden="true" />
      )}
    </button>
  );
}
