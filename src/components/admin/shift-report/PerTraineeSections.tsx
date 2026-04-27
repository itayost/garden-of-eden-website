"use client";

import { memo, useCallback, useMemo } from "react";
import {
  type Control,
  type FieldPath,
  type UseFormGetValues,
  type UseFormReturn,
  type UseFormSetValue,
  useWatch,
} from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TraineeMultiSelect,
  type TraineeOption,
} from "./TraineeMultiSelect";
import type { ShiftReportFormData } from "@/lib/validations/shift-report";
import {
  ACHIEVEMENT_CATEGORIES,
  type AchievementCategory,
} from "@/lib/validations/shift-report";

export type PerTraineeField =
  | "achievements_per_trainee"
  | "worked_on_per_trainee"
  | "new_trainees_per_trainee"
  | "discipline_per_trainee"
  | "injuries_per_trainee"
  | "limitations_per_trainee"
  | "mental_state_per_trainee"
  | "complaints_per_trainee"
  | "insufficient_attention_per_trainee"
  | "pro_candidates_per_trainee"
  | "social_skills_per_trainee";

export type TraineeIdsField =
  | "achievements_trainee_ids"
  | "worked_on_trainee_ids"
  | "new_trainees_ids"
  | "discipline_trainee_ids"
  | "injuries_trainee_ids"
  | "limitations_trainee_ids"
  | "mental_state_trainee_ids"
  | "complaints_trainee_ids"
  | "insufficient_attention_trainee_ids"
  | "pro_candidates_trainee_ids"
  | "social_skills_trainee_ids";

export type BoolField =
  | "has_achievements"
  | "has_worked_on_focus"
  | "trained_new_trainees"
  | "has_discipline_issues"
  | "has_injuries"
  | "has_physical_limitations"
  | "has_poor_mental_state"
  | "has_complaints"
  | "has_insufficient_attention"
  | "has_pro_candidates"
  | "has_social_skills";

interface PerTraineeEntry {
  details?: string;
  categories?: AchievementCategory[];
}

interface PerTraineeCardProps {
  traineeId: string;
  traineeName: string;
  perTraineeField: PerTraineeField;
  control: Control<ShiftReportFormData>;
  setValue: UseFormSetValue<ShiftReportFormData>;
  getValues: UseFormGetValues<ShiftReportFormData>;
  categoriesLabel: string;
  detailsPlaceholder: string;
}

/** One trainee's card with category checkbox grid + details textarea.
 * Subscribed only to its own per-trainee path so typing here does not
 * re-render sibling cards or the parent section. */
const PerTraineeCard = memo(function PerTraineeCard({
  traineeId,
  traineeName,
  perTraineeField,
  control,
  setValue,
  getValues,
  categoriesLabel,
  detailsPlaceholder,
}: PerTraineeCardProps) {
  const entryPath = `${perTraineeField}.${traineeId}` as FieldPath<ShiftReportFormData>;
  const detailsPath = `${perTraineeField}.${traineeId}.details` as FieldPath<ShiftReportFormData>;
  const categoriesPath = `${perTraineeField}.${traineeId}.categories` as FieldPath<ShiftReportFormData>;

  const entry = useWatch({ control, name: entryPath }) as PerTraineeEntry | undefined;
  const details = entry?.details ?? "";
  const categories = entry?.categories ?? [];

  const handleDetailsChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(detailsPath, e.target.value);
    },
    [setValue, detailsPath]
  );

  const handleToggleCategory = useCallback(
    (category: AchievementCategory) => {
      const current =
        (getValues(categoriesPath) as AchievementCategory[] | undefined) ?? [];
      const updated = current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category];
      setValue(categoriesPath, updated);
    },
    [getValues, setValue, categoriesPath]
  );

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h4 className="font-medium text-sm">{traineeName}</h4>

      <div>
        <p className="text-sm text-muted-foreground mb-2">{categoriesLabel}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ACHIEVEMENT_CATEGORIES.map((cat) => (
            <label
              key={cat}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <Checkbox
                checked={categories.includes(cat)}
                onCheckedChange={() => handleToggleCategory(cat)}
              />
              {cat}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-1">פרטים</p>
        <Textarea
          placeholder={detailsPlaceholder}
          value={details}
          onChange={handleDetailsChange}
        />
      </div>
    </div>
  );
});

interface PerTraineeDetailsCardProps {
  traineeId: string;
  traineeName: string;
  perTraineeField: PerTraineeField;
  control: Control<ShiftReportFormData>;
  setValue: UseFormSetValue<ShiftReportFormData>;
  detailsPlaceholder: string;
}

/** One trainee's card with details textarea only (no category taxonomy).
 * Subscribed only to its own per-trainee path. */
const PerTraineeDetailsCard = memo(function PerTraineeDetailsCard({
  traineeId,
  traineeName,
  perTraineeField,
  control,
  setValue,
  detailsPlaceholder,
}: PerTraineeDetailsCardProps) {
  const detailsPath = `${perTraineeField}.${traineeId}.details` as FieldPath<ShiftReportFormData>;
  const details = (useWatch({ control, name: detailsPath }) as string | undefined) ?? "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(detailsPath, e.target.value);
    },
    [setValue, detailsPath]
  );

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <h4 className="font-medium text-sm">{traineeName}</h4>
      <Textarea
        placeholder={detailsPlaceholder}
        value={details}
        onChange={handleChange}
      />
    </div>
  );
});

interface PerTraineeCategoriesSectionProps {
  form: UseFormReturn<ShiftReportFormData>;
  trainees: TraineeOption[];
  label: string;
  boolField: BoolField;
  traineeIdsField: TraineeIdsField;
  perTraineeField: PerTraineeField;
  categoriesLabel: string;
  detailsPlaceholder: string;
}

/** Reusable yes/no question with per-trainee categories + details cards.
 * Parent does NOT subscribe to perTraineeField — each card subscribes to its
 * own sub-path so a keystroke on one card only re-renders that card. */
export const PerTraineeCategoriesSection = memo(function PerTraineeCategoriesSection({
  form,
  trainees,
  label,
  boolField,
  traineeIdsField,
  perTraineeField,
  categoriesLabel,
  detailsPlaceholder,
}: PerTraineeCategoriesSectionProps) {
  const isYes = useWatch({ control: form.control, name: boolField }) as boolean;
  const selectedIds =
    (useWatch({ control: form.control, name: traineeIdsField }) as string[]) || [];

  const traineeNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of trainees) {
      map[t.id] = t.full_name || "מתאמן";
    }
    return map;
  }, [trainees]);

  const handleTraineeIdsChange = useCallback(
    (newIds: string[]) => {
      form.setValue(traineeIdsField, newIds);
      const current = form.getValues(perTraineeField) || {};
      const cleaned: typeof current = {};
      for (const id of newIds) {
        cleaned[id] = current[id] || { details: "", categories: [] };
      }
      form.setValue(perTraineeField, cleaned);
    },
    [form, traineeIdsField, perTraineeField]
  );

  return (
    <div className="space-y-3">
      <FormField
        control={form.control}
        name={boolField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <Select
              onValueChange={(v) => field.onChange(v === "true")}
              value={field.value ? "true" : "false"}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="false">לא</SelectItem>
                <SelectItem value="true">כן</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {isYes && (
        <div className="space-y-4 pr-4 border-r-2 border-primary/20">
          <FormField
            control={form.control}
            name={traineeIdsField}
            render={() => (
              <FormItem>
                <FormLabel>בחר מתאמנים</FormLabel>
                <FormControl>
                  <TraineeMultiSelect
                    trainees={trainees}
                    selected={selectedIds}
                    onChange={handleTraineeIdsChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {selectedIds.map((traineeId) => (
            <PerTraineeCard
              key={traineeId}
              traineeId={traineeId}
              traineeName={traineeNameMap[traineeId] || "מתאמן"}
              perTraineeField={perTraineeField}
              control={form.control}
              setValue={form.setValue}
              getValues={form.getValues}
              categoriesLabel={categoriesLabel}
              detailsPlaceholder={detailsPlaceholder}
            />
          ))}
        </div>
      )}
    </div>
  );
});

interface PerTraineeDetailsSectionProps {
  form: UseFormReturn<ShiftReportFormData>;
  trainees: TraineeOption[];
  label: string;
  boolField: BoolField;
  traineeIdsField: TraineeIdsField;
  perTraineeField: PerTraineeField;
  detailsPlaceholder: string;
}

/** Reusable yes/no question with per-trainee details textareas (no
 * category taxonomy). Same wiring as PerTraineeCategoriesSection but each
 * card renders only a textarea. */
export const PerTraineeDetailsSection = memo(function PerTraineeDetailsSection({
  form,
  trainees,
  label,
  boolField,
  traineeIdsField,
  perTraineeField,
  detailsPlaceholder,
}: PerTraineeDetailsSectionProps) {
  const isYes = useWatch({ control: form.control, name: boolField }) as boolean;
  const selectedIds =
    (useWatch({ control: form.control, name: traineeIdsField }) as string[]) || [];

  const traineeNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of trainees) {
      map[t.id] = t.full_name || "מתאמן";
    }
    return map;
  }, [trainees]);

  const handleTraineeIdsChange = useCallback(
    (newIds: string[]) => {
      form.setValue(traineeIdsField, newIds);
      const current = form.getValues(perTraineeField) || {};
      const cleaned: typeof current = {};
      for (const id of newIds) {
        cleaned[id] = current[id] || { details: "" };
      }
      form.setValue(perTraineeField, cleaned);
    },
    [form, traineeIdsField, perTraineeField]
  );

  return (
    <div className="space-y-3">
      <FormField
        control={form.control}
        name={boolField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <Select
              onValueChange={(v) => field.onChange(v === "true")}
              value={field.value ? "true" : "false"}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="false">לא</SelectItem>
                <SelectItem value="true">כן</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {isYes && (
        <div className="space-y-4 pr-4 border-r-2 border-primary/20">
          <FormField
            control={form.control}
            name={traineeIdsField}
            render={() => (
              <FormItem>
                <FormLabel>בחר מתאמנים</FormLabel>
                <FormControl>
                  <TraineeMultiSelect
                    trainees={trainees}
                    selected={selectedIds}
                    onChange={handleTraineeIdsChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {selectedIds.map((traineeId) => (
            <PerTraineeDetailsCard
              key={traineeId}
              traineeId={traineeId}
              traineeName={traineeNameMap[traineeId] || "מתאמן"}
              perTraineeField={perTraineeField}
              control={form.control}
              setValue={form.setValue}
              detailsPlaceholder={detailsPlaceholder}
            />
          ))}
        </div>
      )}
    </div>
  );
});
