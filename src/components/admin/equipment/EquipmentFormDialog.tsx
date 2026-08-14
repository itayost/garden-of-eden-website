"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createEquipmentAction,
  updateEquipmentAction,
} from "@/lib/actions/equipment";
import {
  equipmentFormSchema,
  type EquipmentFormInput,
} from "@/lib/validations/exercise-log";
import { numText } from "@/lib/utils/performance-profile";
import type { Equipment } from "@/types/equipment";
import { EquipmentTrackingFields } from "./EquipmentTrackingFields";

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null = create. Parent remounts via key so state initializes fresh. */
  equipment: Equipment | null;
}

function toFormValues(equipment: Equipment | null): EquipmentFormInput {
  return {
    isActive: equipment?.is_active ?? true,
    name: equipment?.name_he ?? "",
    notes: equipment?.notes_he ?? "",
    howto: equipment?.howto_he ?? "",
    // A brand-new machine measures weight and reps, which is what every
    // machine effectively did before profiles existed.
    tracksWeight: equipment?.tracks_weight ?? true,
    tracksReps: equipment?.tracks_reps ?? true,
    tracksDuration: equipment?.tracks_duration ?? false,
    tracksDistance: equipment?.tracks_distance ?? false,
    defaultSets: numText(equipment?.default_sets),
    defaultReps: numText(equipment?.default_reps),
    defaultWeightKg: numText(equipment?.default_weight_kg),
    defaultDurationSeconds: numText(equipment?.default_duration_seconds),
    defaultDistanceM: numText(equipment?.default_distance_m),
    weightMinKg: numText(equipment?.weight_min_kg),
    weightMaxKg: numText(equipment?.weight_max_kg),
    weightStepKg: numText(equipment?.weight_step_kg),
  };
}

export function EquipmentFormDialog({
  open,
  onOpenChange,
  equipment,
}: EquipmentFormDialogProps) {
  const router = useRouter();

  const form = useForm<EquipmentFormInput>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: toFormValues(equipment),
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const nameValue = watch("name");
  const formError = Object.entries(errors).find(
    ([field]) => field !== "name",
  )?.[1]?.message;

  const onSubmit = async (values: EquipmentFormInput) => {
    try {
      const result = equipment
        ? await updateEquipmentAction({ ...values, equipmentId: equipment.id })
        : await createEquipmentAction(values);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(equipment ? "הציוד עודכן" : "הציוד נוצר — אפשר להדפיס מדבקה");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת הציוד");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[90dvh] overflow-y-auto sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{equipment ? "עריכת ציוד" : "ציוד חדש"}</DialogTitle>
          <DialogDescription>
            {equipment
              ? "הקוד וה-QR לא משתנים — המדבקות שהודפסו נשארות תקפות."
              : "קוד ה-QR נוצר אוטומטית עם השמירה."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="equipment-name">שם</Label>
            <Input
              id="equipment-name"
              placeholder="לדוגמה: מתקן סקוואט"
              disabled={isSubmitting}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            )}
          </div>

          <EquipmentTrackingFields form={form} disabled={isSubmitting} />

          {/* A cross-field failure lands on a specific input, and that input
              may be hidden behind its measure toggle. Surfacing the first
              non-name error covers every such case without a whitelist that
              goes stale each time a field is added. */}
          {formError && <p className="text-destructive text-xs">{formError}</p>}

          <div className="space-y-2">
            <Label htmlFor="equipment-notes">הערות (אופציונלי)</Label>
            <Textarea
              id="equipment-notes"
              rows={2}
              disabled={isSubmitting}
              {...register("notes")}
            />
          </div>

          {equipment && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="equipment-active">פעיל</Label>
                <p className="text-xs text-muted-foreground">
                  ציוד לא פעיל לא נסרק ולא מופיע בבחירת תרגילים.
                </p>
              </div>
              <Switch
                id="equipment-active"
                checked={watch("isActive")}
                onCheckedChange={(next) =>
                  setValue("isActive", next, { shouldDirty: true })
                }
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={isSubmitting || !nameValue?.trim()}>
              {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              שמירה
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
