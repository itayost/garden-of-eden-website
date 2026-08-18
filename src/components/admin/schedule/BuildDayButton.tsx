"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { buildDayFromWeeklyScheduleAction } from "@/lib/actions/daily-schedule";

interface BuildDayButtonProps {
  /** The day currently viewed — the build target. */
  targetDate: string;
  /** The action refuses to build onto a non-empty day; disable upfront. */
  targetHasSlots: boolean;
  /** Working stretches the weekly schedule puts on this day, standby excluded. */
  bandCount: number;
  /** The week view puts this in a column, where the daily board's sizing does not fit. */
  compact?: boolean;
}

export function BuildDayButton({
  targetDate,
  targetHasSlots,
  bandCount,
  compact = false,
}: BuildDayButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBuild = async () => {
    setLoading(true);
    try {
      const result = await buildDayFromWeeklyScheduleAction({ date: targetDate });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`נבנו ${result.count} סלוטים — נותר להשלים שמות`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בבניית הלוח");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className={compact ? "w-full text-xs" : undefined}
          disabled={targetHasSlots || bandCount === 0}
          aria-label="בנה מהלוח השבועי"
        >
          <CalendarRange className="h-4 w-4" />
          {/* Icon-only on a phone on the daily board; a column always has room
              for the words, and an unlabelled icon there would be a riddle. */}
          <span className={compact ? undefined : "hidden sm:inline"}>
            בנה מהלוח השבועי
          </span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>בניית לוח מהלוח השבועי</AlertDialogTitle>
          <AlertDialogDescription>
            ייווצרו {bandCount} סלוטים לפי השיבוץ השבועי — שעה, מאמן ומיקום.
            רשימות המתאמנים יישארו ריקות ויש להשלים אותן. רצועות ״חיזוק במידת
            הצורך״ לא ייבנו.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              handleBuild();
            }}
            disabled={loading}
          >
            {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            בנייה
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
