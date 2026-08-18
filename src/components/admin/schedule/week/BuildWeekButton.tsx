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
import { buildWeekFromWeeklyScheduleAction } from "@/lib/actions/daily-schedule";

interface BuildWeekButtonProps {
  /** The Sunday of the week on screen. */
  weekStart: string;
  /** Days the action would seed, counted with the same rule it uses. */
  buildableCount: number;
  /** Slots those days would produce, for the confirmation. */
  slotCount: number;
}

/**
 * Seeds every unbuilt day of the week in one press.
 *
 * Hidden rather than disabled when there is nothing to build: on a week that is
 * already done, a permanently greyed button is just noise. The per-day buttons
 * stay where they are, and remain the only way to backfill a day already past.
 */
export function BuildWeekButton({
  weekStart,
  buildableCount,
  slotCount,
}: BuildWeekButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (buildableCount === 0) return null;

  const handleBuild = async () => {
    setLoading(true);
    try {
      const result = await buildWeekFromWeeklyScheduleAction({ weekStart });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `נבנו ${result.count} סלוטים ב-${result.dayCount} ימים — נותר להשלים שמות`,
      );
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בבניית השבוע");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          <CalendarRange className="h-4 w-4" />
          בנה את כל השבוע
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>בניית השבוע מהלוח השבועי</AlertDialogTitle>
          <AlertDialogDescription>
            ייווצרו {slotCount} סלוטים ב-{buildableCount} ימים שעדיין לא נבנו.
            ימים שכבר יש להם לוח, וימים שעברו, לא ישתנו. רשימות המתאמנים יישארו
            ריקות ויש להשלים אותן. רצועות ״חיזוק במידת הצורך״ לא ייבנו.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>ביטול</AlertDialogCancel>
          <AlertDialogAction onClick={handleBuild} disabled={loading}>
            {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {loading ? "בונה..." : "בנה"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
