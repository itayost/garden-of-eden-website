"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { duplicateDayAction } from "@/lib/actions/daily-schedule";

interface DuplicateDayButtonProps {
  /** The day currently viewed — the duplication TARGET. */
  targetDate: string;
  /** The action refuses to duplicate onto a non-empty day; disable upfront. */
  targetHasSlots: boolean;
}

/** Yesterday relative to the target, the overwhelmingly common source. */
function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function DuplicateDayButton({
  targetDate,
  targetHasSlots,
}: DuplicateDayButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState(previousDay(targetDate));
  const [loading, setLoading] = useState(false);

  const handleDuplicate = async () => {
    setLoading(true);
    try {
      const result = await duplicateDayAction({ fromDate, toDate: targetDate });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`שוכפלו ${result.count} סלוטים`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשכפול היום");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {/* Icon-only on a phone — see CopyWhatsAppButton. */}
        <Button
          variant="outline"
          disabled={targetHasSlots}
          aria-label="שכפל מיום קודם"
        >
          <CopyPlus className="h-4 w-4" />
          <span className="hidden sm:inline">שכפל מיום קודם</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>שכפול לוח</AlertDialogTitle>
          <AlertDialogDescription>
            כל הסלוטים של יום המקור יועתקו ליום הנוכחי, כולל רשימות המתאמנים.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="duplicate-from">יום המקור</Label>
          <Input
            id="duplicate-from"
            type="date"
            value={fromDate}
            max={targetDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              handleDuplicate();
            }}
            disabled={loading || !fromDate}
          >
            {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            שכפול
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
