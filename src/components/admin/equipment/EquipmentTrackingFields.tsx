"use client";

import type { UseFormReturn } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MEASURE_DEFS, type MeasureDef } from "@/lib/validations/measures";
import type { EquipmentFormInput } from "@/lib/validations/exercise-log";

/**
 * The "ביצוע" half of the equipment form: what the machine measures, and the
 * numbers a trainer and trainee start from.
 *
 * Every default input is gated on its own measure toggle. That is not only
 * tidiness — the schema rejects a default for a measure the machine does not
 * track, so a hidden field holding a stale value would block the save.
 */

interface EquipmentTrackingFieldsProps {
  /** One form object, matching how the other split forms in admin/ do it. */
  form: UseFormReturn<EquipmentFormInput>;
  disabled: boolean;
}

/** Per-measure input config. Only the label and unit differ. */
const DEFAULT_INPUTS: Record<
  MeasureDef["field"],
  { label: string; step?: string }
> = {
  tracksReps: { label: "חזרות" },
  tracksWeight: { label: 'משקל (ק"ג)', step: "0.5" },
  tracksDuration: { label: "זמן (שניות)" },
  tracksDistance: { label: "מרחק (מטרים)" },
};

export function EquipmentTrackingFields({
  form,
  disabled,
}: EquipmentTrackingFieldsProps) {
  const { register, watch, setValue } = form;

  const isOn = (measure: MeasureDef) => Boolean(watch(measure.field));

  const toggle = (measure: MeasureDef) => {
    const next = !isOn(measure);
    setValue(measure.field, next, { shouldValidate: true, shouldDirty: true });

    // Clearing the orphaned default keeps the form saveable: the schema
    // rejects a default for an untracked measure, and the input that holds
    // it is about to disappear.
    if (!next) {
      setValue(measure.defaultField, "", {
        shouldValidate: true,
        shouldDirty: true,
      });

      if (measure.field === "tracksWeight") {
        for (const field of ["weightMinKg", "weightMaxKg", "weightStepKg"] as const) {
          setValue(field, "", { shouldDirty: true });
        }
      }
    }
  };

  return (
    <div className="space-y-4 rounded-xl border bg-muted/30 p-3">
      <div className="space-y-2">
        <Label>מה נמדד במכשיר?</Label>
        <div className="flex flex-wrap gap-1.5">
          {MEASURE_DEFS.map((measure) => {
            const on = isOn(measure);
            return (
              <button
                key={measure.field}
                type="button"
                onClick={() => toggle(measure)}
                disabled={disabled}
                aria-pressed={on}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {measure.label}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">
          קובע אילו שדות המתאמן ימלא. חבל קפיצה לא יראה שדה משקל בכלל.
        </p>
      </div>

      <div className="space-y-2">
        <Label>ברירות מחדל</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {/* Sets applies to every machine, so it sits outside the loop. */}
          <NumberField
            id="equipment-default-sets"
            label="סטים"
            disabled={disabled}
            {...register("defaultSets")}
          />
          {MEASURE_DEFS.filter(isOn).map((measure) => (
            <NumberField
              key={measure.defaultField}
              id={`equipment-${measure.defaultField}`}
              label={DEFAULT_INPUTS[measure.field].label}
              step={DEFAULT_INPUTS[measure.field].step}
              disabled={disabled}
              {...register(measure.defaultField)}
            />
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          מה שהמאמן יראה מוכן כשיוסיף תרגיל על המכשיר הזה. אפשר להשאיר ריק.
        </p>
      </div>

      {watch("tracksWeight") && (
        <div className="space-y-2">
          <Label>טווח משקל</Label>
          <div className="grid grid-cols-3 gap-2">
            <NumberField
              id="equipment-weight-min"
              label="מינימום"
              step="0.5"
              disabled={disabled}
              {...register("weightMinKg")}
            />
            <NumberField
              id="equipment-weight-max"
              label="מקסימום"
              step="0.5"
              disabled={disabled}
              {...register("weightMaxKg")}
            />
            <NumberField
              id="equipment-weight-step"
              label="קפיצות"
              step="0.5"
              disabled={disabled}
              {...register("weightStepKg")}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            הקפיצות קובעות את כפתורי הפלוס והמינוס אצל המתאמן.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="equipment-howto">איך מבצעים</Label>
        <Textarea
          id="equipment-howto"
          rows={2}
          placeholder="גובה מושב, מיקום פין, כפות רגליים ברוחב כתפיים..."
          disabled={disabled}
          {...register("howto")}
        />
        <p className="text-muted-foreground text-xs">
          הגדרות המכשיר עצמו. הוראות הביצוע של התרגיל נשארות על התרגיל.
        </p>
      </div>
    </div>
  );
}
