"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, MapPin, Pencil, Trash2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteBandAction } from "@/lib/actions/weekly-schedule";
import { trainerColor } from "@/lib/utils/trainer-color";
import type { WeeklyBand } from "@/types/weekly-schedule";

interface BandCardProps {
  band: WeeklyBand;
  /** Admins edit the standing week; trainers read it. */
  canEdit: boolean;
  onEdit: () => void;
}

/** "15:00–18:00", or "18:00 והלאה" when the stretch is open-ended. */
export function bandTimeLabel(band: WeeklyBand): string {
  const start = band.start_time.slice(0, 5);
  if (!band.end_time) return `${start} והלאה`;
  return `${start}–${band.end_time.slice(0, 5)}`;
}

export function BandCard({ band, canEdit, onEdit }: BandCardProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const palette = trainerColor(band.trainer_id);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteBandAction(band.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("הרצועה נמחקה");
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error("שגיאה במחיקת הרצועה");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "group rounded-xl border p-2.5",
          palette.bg,
          // Standby is real but conditional, so it reads as provisional rather
          // than as a second-class row.
          band.is_standby && "border-dashed opacity-90",
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 space-y-1">
            <p className="font-display text-sm tabular-nums text-forest">
              {bandTimeLabel(band)}
            </p>

            <div className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", palette.dot)} />
              <span className={cn("truncate text-sm font-bold", palette.text)}>
                {band.trainer_name}
              </span>
            </div>

            {band.label_he && (
              <p className="truncate text-xs text-muted-foreground">
                {band.label_he}
              </p>
            )}

            {band.location_he && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{band.location_he}</span>
              </p>
            )}

            {band.is_standby && (
              <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <LifeBuoy className="h-3 w-3 shrink-0" />
                חיזוק במידת הצורך
              </p>
            )}
          </div>

          {canEdit && (
            // Always visible on touch, where there is no hover to reveal them.
            <div className="flex shrink-0 flex-col gap-0.5 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onEdit}
                aria-label={`עריכת הרצועה של ${band.trainer_name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setConfirmOpen(true)}
                aria-label={`מחיקת הרצועה של ${band.trainer_name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת רצועה</AlertDialogTitle>
            <AlertDialogDescription>
              הרצועה של {band.trainer_name} ב-{bandTimeLabel(band)} תימחק
              לצמיתות. לוחות יומיים שכבר נבנו לא ישתנו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "מוחק..." : "מחיקה"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
