"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dumbbell, MapPin, Pencil, Plus, Trash2, User } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { deleteSlotAction } from "@/lib/actions/daily-schedule";
import type { ScheduleSlot } from "@/types/schedule";
import type { SessionSummary } from "@/types/training-session";

interface SlotCardProps {
  slot: ScheduleSlot;
  /** The day being viewed — carried into the session builder link. */
  date: string;
  /** trainee_id -> session summary for this day. */
  sessionSummaries: Record<string, SessionSummary>;
  isAdmin: boolean;
  /** True when the viewing trainer is this slot's trainer — highlighted. */
  isMine: boolean;
  onEdit: () => void;
}

export function SlotCard({
  slot,
  date,
  sessionSummaries,
  isAdmin,
  isMine,
  onEdit,
}: SlotCardProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteSlotAction(slot.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("הסלוט נמחק");
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error("שגיאה במחיקת הסלוט");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className={cn(isMine && "border-primary")}>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 font-medium">
              <User className="h-4 w-4 text-muted-foreground" />
              {slot.trainer_name ?? "ללא מאמן"}
            </span>
            {slot.location_he && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {slot.location_he}
              </span>
            )}
            {isMine && <Badge variant="secondary">שלי</Badge>}
          </div>

          {isAdmin && (
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                aria-label="עריכת סלוט"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfirmOpen(true)}
                aria-label="מחיקת סלוט"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {slot.trainees.map((trainee) => {
              // Free-text names have no account and cannot receive sessions —
              // they stay plain badges.
              if (!trainee.trainee_id) {
                return (
                  <Badge key={trainee.id} variant="outline" className="font-normal">
                    {trainee.trainee_name}
                  </Badge>
                );
              }

              const summary = sessionSummaries[trainee.trainee_id];
              return (
                <Link
                  key={trainee.id}
                  href={`/admin/schedule/session/${trainee.trainee_id}?date=${date}&slot=${slot.id}`}
                  aria-label={
                    summary
                      ? `עריכת האימון של ${trainee.trainee_name}`
                      : `בניית אימון עבור ${trainee.trainee_name}`
                  }
                >
                  <Badge
                    variant={summary ? "default" : "secondary"}
                    className="gap-1 font-normal transition-opacity hover:opacity-80"
                  >
                    {summary ? (
                      <Dumbbell className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {trainee.trainee_name}
                    {summary ? ` (${summary.exerciseCount})` : ""}
                  </Badge>
                </Link>
              );
            })}
          </div>
          {slot.focus_he && (
            <p className="text-sm text-muted-foreground">{slot.focus_he}</p>
          )}
          <p className="text-xs text-muted-foreground">
            לחיצה על מתאמן מקושר בונה או עורכת את האימון שלו להיום.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת סלוט</AlertDialogTitle>
            <AlertDialogDescription>
              הסלוט של {slot.trainer_name ?? "ללא מאמן"} ב-
              {slot.start_time.slice(0, 5)} יימחק לצמיתות.
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
