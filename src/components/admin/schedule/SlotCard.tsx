"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Dumbbell, HeartPulse, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
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
import { trainerColor } from "@/lib/utils/trainer-color";
import type { ScheduleSlot } from "@/types/schedule";
import type { SessionSummary } from "@/types/training-session";
import type { StaffPlanBadge } from "@/types/plans";
import { HealthSheet } from "@/features/plans/components/HealthSheet";

/** Only the states that need a trainer's attention get a chip. */
const PLAN_CHIP: Partial<Record<StaffPlanBadge["status"], { label: string; className: string }>> = {
  expired: { label: "פג", className: "bg-destructive text-white" },
  ending_soon: { label: "מסתיים", className: "bg-amber-500 text-black" },
};

interface SlotCardProps {
  slot: ScheduleSlot;
  /** The day being viewed — carried into the session builder link. */
  date: string;
  /** trainee_id -> session summary for this day. */
  sessionSummaries: Record<string, SessionSummary>;
  /** trainee_id -> plan status and medical flag. */
  planBadges: Record<string, StaffPlanBadge>;
  /** True when the viewing trainer is this slot's trainer — highlighted. */
  isMine: boolean;
  onEdit: () => void;
}

/**
 * Editing is not gated here: the page is already behind verifyAdminOrTrainer,
 * and the board is one shared document that any staff member may fix.
 */
export function SlotCard({
  slot,
  date,
  sessionSummaries,
  planBadges,
  isMine,
  onEdit,
}: SlotCardProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [healthFor, setHealthFor] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const palette = trainerColor(slot.trainer_id);

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
      <Card
        className={cn(
          "gap-2 overflow-hidden rounded-2xl py-0",
          isMine && "ring-2 ring-forest/60",
        )}
      >
        <CardHeader
          className={cn(
            "flex flex-row items-start justify-between gap-2 space-y-0 px-4 pb-2 pt-3",
            palette.bg,
          )}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", palette.dot)} />
              <span className={cn("text-base font-extrabold", palette.text)}>
                {slot.trainer_name ?? "ללא מאמן"}
              </span>
              {slot.location_he && (
                <span className="flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {slot.location_he}
                </span>
              )}
              {isMine && (
                <Badge className="bg-forest text-cream hover:bg-forest">שלי</Badge>
              )}
            </div>
            {slot.focus_he && (
              <p className="mt-0.5 text-xs italic text-muted-foreground">
                {slot.focus_he}
              </p>
            )}
          </div>

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
        </CardHeader>

        <CardContent className="space-y-2 px-4 pb-3">
          {/*
            A slot seeded from the weekly schedule arrives with the hour and the
            trainer but no names. That is a half-built row, so it says so and
            offers the one action that finishes it, rather than rendering as an
            ordinary slot that happens to look empty.
          */}
          {slot.trainees.length === 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="w-full border-dashed text-muted-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              הוספת מתאמנים
            </Button>
          ) : (
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
              const completed = Boolean(summary?.completed_at);
              const badge = planBadges[trainee.trainee_id];
              const chip = badge?.endsOn ? PLAN_CHIP[badge.status] : undefined;
              return (
                <span key={trainee.id} className="inline-flex items-center gap-0.5">
                <Link
                  href={`/admin/schedule/session/${trainee.trainee_id}?date=${date}&slot=${slot.id}`}
                  aria-label={
                    summary
                      ? `עריכת האימון של ${trainee.trainee_name}`
                      : `בניית אימון עבור ${trainee.trainee_name}`
                  }
                >
                  <Badge
                    variant={summary ? "default" : "secondary"}
                    className={cn(
                      "gap-1 font-normal transition-opacity hover:opacity-80",
                      completed &&
                        "bg-green-600 text-white hover:bg-green-600/90",
                    )}
                  >
                    {completed ? (
                      <Check className="h-3 w-3" />
                    ) : summary ? (
                      <Dumbbell className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {trainee.trainee_name}
                    {summary ? ` (${summary.exerciseCount})` : ""}
                  </Badge>
                </Link>
                {chip && (
                  <span
                    className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", chip.className)}
                    title={badge.sessionsLeft !== null ? `${badge.sessionsLeft} אימונים נותרו` : undefined}
                  >
                    {chip.label}
                  </span>
                )}
                {badge?.hasMedicalNotes && (
                  <button
                    type="button"
                    onClick={() =>
                      setHealthFor({ id: trainee.trainee_id!, name: trainee.trainee_name })
                    }
                    className="rounded-full p-0.5 text-amber-600 hover:bg-amber-100"
                    aria-label={`מידע רפואי של ${trainee.trainee_name}`}
                  >
                    <HeartPulse className="h-3.5 w-3.5" />
                  </button>
                )}
                </span>
              );
            })}
          </div>
          )}
        </CardContent>
      </Card>

      {healthFor && (
        <HealthSheet
          traineeId={healthFor.id}
          traineeName={healthFor.name}
          open
          onOpenChange={(open) => !open && setHealthFor(null)}
        />
      )}

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
