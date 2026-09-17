"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, HeartPulse, Loader2, MapPin, Pencil, Trash2, Users, X } from "lucide-react";
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
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SheetDialogContent } from "@/components/ui/sheet-dialog";
import { TraineeSearch } from "@/components/admin/schedule/TraineeSearch";
import { HealthSheet } from "@/features/plans/components/HealthSheet";
import { PlanSheet } from "@/features/plans/components/staff/PlanSheet";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import {
  addSlotTraineeAction,
  deleteSlotAction,
  removeSlotTraineeAction,
} from "@/lib/actions/daily-schedule";
import { cn } from "@/lib/utils";
import { trainerColor } from "@/lib/utils/trainer-color";
import { STAFF_PLAN_CHIP } from "@/lib/plans/status-styles";
import type { StaffPlanBadge } from "@/types/plans";
import type { ScheduleSlot, SlotTrainee } from "@/types/schedule";

/** Only the states that need a trainer's attention get a chip. */
interface RosterSheetProps {
  /** The slot on screen, looked up from fresh page data; null closes the sheet. */
  slot: ScheduleSlot | null;
  onClose: () => void;
  trainees: TrainerOption[];
  planBadges: Record<string, StaffPlanBadge>;
  /** Admins may edit plans from the plan sheet. */
  isAdmin: boolean;
  onEditDetails: (slot: ScheduleSlot) => void;
}

/**
 * Who is in one slot. The only place in the calendar that changes a roster,
 * and it never builds sessions: that is the בניית אימונים screen's job.
 */
export function RosterSheet({ slot, onClose, trainees, planBadges, isAdmin, onEditDetails }: RosterSheetProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [planFor, setPlanFor] = useState<{ id: string; name: string } | null>(null);
  const [healthFor, setHealthFor] = useState<{ id: string; name: string } | null>(null);

  const active = useMemo(() => slot?.trainees.filter((t) => t.cancelled_at === null) ?? [], [slot]);
  const lateCancels = slot?.trainees.filter((t) => t.cancelled_at !== null && t.late_cancel) ?? [];
  const activeIds = useMemo(
    () => new Set(active.flatMap((t) => (t.trainee_id ? [t.trainee_id] : []))),
    [active],
  );

  if (!slot) return null;

  const palette = trainerColor(slot.trainer_id);
  const time = slot.start_time.slice(0, 5);
  const overCapacity = slot.max_trainees !== null && active.length > slot.max_trainees;

  const add = async (entry: { traineeId: string | null; name: string }) => {
    setAdding(true);
    try {
      const result = await addSlotTraineeAction({ slotId: slot.id, ...entry });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.data.overCapacity) toast.warning("הסלוט מעבר לקיבולת");
      else toast.success(`${entry.name} נוסף לסלוט`);
      router.refresh();
    } catch {
      toast.error("שגיאה בהוספת המתאמן");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (entry: SlotTrainee) => {
    setBusyId(entry.id);
    try {
      const result = await removeSlotTraineeAction({ rosterEntryId: entry.id });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`${entry.trainee_name} הוסר מהסלוט`);
      router.refresh();
    } catch {
      toast.error("שגיאה בהסרת המתאמן");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteSlotAction(slot.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("הסלוט נמחק");
      setConfirmDelete(false);
      onClose();
      router.refresh();
    } catch {
      toast.error("שגיאה במחיקת הסלוט");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <SheetDialogContent>
          <DialogHeader className={cn("px-4 pt-4 pb-3 text-start sm:px-6 sm:pt-6", palette.bg)}>
            <div className="flex items-start justify-between gap-2 pe-10">
              <div className="min-w-0">
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span className="font-display tabular-nums">{time}</span>
                  <span className={cn("font-extrabold", palette.text)}>{slot.trainer_name ?? "ללא מאמן"}</span>
                </DialogTitle>
                <DialogDescription className="mt-1 flex flex-wrap items-center gap-2">
                  {slot.location_he && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {slot.location_he}
                    </span>
                  )}
                  <span className={cn("flex items-center gap-1 tabular-nums", overCapacity && "text-destructive")}>
                    <Users className="h-3 w-3" />
                    {slot.max_trainees === null ? active.length : `${active.length}/${slot.max_trainees}`}
                  </span>
                  {slot.focus_he && <span className="italic">{slot.focus_he}</span>}
                </DialogDescription>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => onEditDetails(slot)} aria-label="עריכת פרטי הסלוט">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} aria-label="מחיקת סלוט">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-3 pb-4 sm:px-6 sm:pb-6">
            {overCapacity && (
              <p className="text-xs text-destructive">
                מעבר לקיבולת ({active.length}/{slot.max_trainees}). הצוות רשאי, המתאמנים לא.
              </p>
            )}

            {active.length === 0 ? (
              <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
                אין רשומים לסלוט הזה
              </p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {active.map((entry) => {
                  const badge = entry.trainee_id ? planBadges[entry.trainee_id] : undefined;
                  const chip = badge?.endsOn ? STAFF_PLAN_CHIP[badge.status] : undefined;
                  return (
                    <li key={entry.id} className="flex items-center gap-2 px-3 py-2">
                      <span className={cn("min-w-0 flex-1 truncate text-sm", !entry.trainee_id && "text-muted-foreground")}>
                        {entry.trainee_name}
                        {!entry.trainee_id && <span className="ms-1 text-[11px]">(ללא חשבון)</span>}
                      </span>
                      {entry.source === "self" && (
                        <CalendarCheck className="h-4 w-4 shrink-0 text-forest" aria-label="נרשם בעצמו" />
                      )}
                      {chip && entry.trainee_id && (
                        <button
                          type="button"
                          onClick={() => setPlanFor({ id: entry.trainee_id!, name: entry.trainee_name })}
                          className="-my-1 inline-flex min-h-10 shrink-0 items-center px-1"
                          title={badge?.sessionsLeft != null ? `${badge.sessionsLeft} אימונים נותרו` : undefined}
                          aria-label={`המסלול של ${entry.trainee_name}: ${chip.label}`}
                        >
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", chip.className)}>
                            {chip.label}
                          </span>
                        </button>
                      )}
                      {badge?.hasMedicalNotes && entry.trainee_id && (
                        <button
                          type="button"
                          onClick={() => setHealthFor({ id: entry.trainee_id!, name: entry.trainee_name })}
                          className="-my-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-amber-700 hover:bg-amber-100"
                          aria-label={`מידע רפואי של ${entry.trainee_name}`}
                        >
                          <HeartPulse className="h-4 w-4" />
                        </button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10 shrink-0"
                        disabled={busyId !== null}
                        onClick={() => remove(entry)}
                        aria-label={`הסרת ${entry.trainee_name} מהסלוט`}
                      >
                        {busyId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            {lateCancels.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">ביטולים מאוחרים (נחשבים כאימון שנוצל)</p>
                <div className="flex flex-wrap gap-1.5">
                  {lateCancels.map((entry) => (
                    <span key={entry.id} className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground line-through">
                      {entry.trainee_name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="roster-add-search">הוספת מתאמן</Label>
              <TraineeSearch
                idPrefix="roster-add"
                options={trainees}
                excludeIds={activeIds}
                disabled={adding}
                onPickLinked={(trainee) => add({ traineeId: trainee.id, name: trainee.full_name ?? "ללא שם" })}
                onPickFreeText={(name) => add({ traineeId: null, name })}
              />
            </div>
          </div>
        </SheetDialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת סלוט</AlertDialogTitle>
            <AlertDialogDescription>
              הסלוט של {slot.trainer_name ?? "ללא מאמן"} ב-{time} יימחק לצמיתות, כולל רשימת המתאמנים.
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

      {planFor && (
        <PlanSheet
          traineeId={planFor.id}
          traineeName={planFor.name}
          isAdmin={isAdmin}
          open
          onOpenChange={(open) => !open && setPlanFor(null)}
        />
      )}
      {healthFor && (
        <HealthSheet
          traineeId={healthFor.id}
          traineeName={healthFor.name}
          open
          onOpenChange={(open) => !open && setHealthFor(null)}
        />
      )}
    </>
  );
}
