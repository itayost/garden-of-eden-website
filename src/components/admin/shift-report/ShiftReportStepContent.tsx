"use client";

import { UseFormReturn } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TraineeMultiSelect,
  type TraineeOption,
} from "./TraineeMultiSelect";
import type { ShiftReportFormData } from "@/lib/validations/shift-report";

export const SHIFT_REPORT_STEPS = [
  { key: "basic", title: "מידע בסיסי" },
  { key: "issues", title: "בעיות מתאמנים" },
  { key: "positives", title: "הישגים ורווחה" },
  { key: "parents", title: "הורים ומבקרים" },
  { key: "facility", title: "מתקן" },
];

interface StepProps {
  form: UseFormReturn<ShiftReportFormData>;
  trainees: TraineeOption[];
  trainerName: string;
}

/** Reusable yes/no question with conditional trainee multi-select + text details */
function YesNoWithTrainees({
  form,
  label,
  boolField,
  traineeIdsField,
  detailsField,
  detailsPlaceholder,
  trainees,
}: {
  form: UseFormReturn<ShiftReportFormData>;
  label: string;
  boolField: keyof ShiftReportFormData;
  traineeIdsField: keyof ShiftReportFormData;
  detailsField: keyof ShiftReportFormData;
  detailsPlaceholder: string;
  trainees: TraineeOption[];
}) {
  const isYes = form.watch(boolField) as boolean;

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
        <div className="space-y-3 pr-4 border-r-2 border-primary/20">
          <FormField
            control={form.control}
            name={traineeIdsField}
            render={({ field }) => (
              <FormItem>
                <FormLabel>בחר מתאמנים</FormLabel>
                <FormControl>
                  <TraineeMultiSelect
                    trainees={trainees}
                    selected={(field.value as string[]) || []}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={detailsField}
            render={({ field }) => (
              <FormItem>
                <FormLabel>פרטים</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={detailsPlaceholder}
                    {...field}
                    value={(field.value as string) || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}

/** Reusable yes/no question with conditional text only (no trainee select) */
function YesNoWithText({
  form,
  label,
  boolField,
  detailsField,
  detailsPlaceholder,
  invertedLabel,
}: {
  form: UseFormReturn<ShiftReportFormData>;
  label: string;
  boolField: keyof ShiftReportFormData;
  detailsField: keyof ShiftReportFormData;
  detailsPlaceholder: string;
  /** If true, show details when answer is "no" (e.g. facility questions) */
  invertedLabel?: boolean;
}) {
  const value = form.watch(boolField) as boolean;
  const showDetails = invertedLabel ? !value : value;

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
                {invertedLabel ? (
                  <>
                    <SelectItem value="true">כן</SelectItem>
                    <SelectItem value="false">לא</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="false">לא</SelectItem>
                    <SelectItem value="true">כן</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {showDetails && (
        <div className="pr-4 border-r-2 border-primary/20">
          <FormField
            control={form.control}
            name={detailsField}
            render={({ field }) => (
              <FormItem>
                <FormLabel>פרטים</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={detailsPlaceholder}
                    {...field}
                    value={(field.value as string) || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}

// Step 1: Basic Info
function BasicInfoStep({ form, trainees, trainerName }: StepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>מידע בסיסי</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-filled trainer name (read-only) */}
        <div>
          <label className="text-sm font-medium">שם המאמן</label>
          <Input value={trainerName} disabled className="mt-1.5" />
        </div>

        {/* Auto-filled date */}
        <FormField
          control={form.control}
          name="report_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>תאריך</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <YesNoWithTrainees
          form={form}
          label="האם אימנת מתאמנים חדשים?"
          boolField="trained_new_trainees"
          traineeIdsField="new_trainees_ids"
          detailsField="new_trainees_details"
          detailsPlaceholder="פרט את התקדמות האימון של המתאמנים החדשים"
          trainees={trainees}
        />
      </CardContent>
    </Card>
  );
}

// Step 2: Trainee Issues
function TraineeIssuesStep({ form, trainees }: Omit<StepProps, "trainerName">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>בעיות מתאמנים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <YesNoWithTrainees
          form={form}
          label="האם הייתה בעיית משמעת עם מתאמן?"
          boolField="has_discipline_issues"
          traineeIdsField="discipline_trainee_ids"
          detailsField="discipline_details"
          detailsPlaceholder="פרט את בעיית המשמעת"
          trainees={trainees}
        />

        <YesNoWithTrainees
          form={form}
          label="האם זיהית או שמעת על פציעה של מתאמן?"
          boolField="has_injuries"
          traineeIdsField="injuries_trainee_ids"
          detailsField="injuries_details"
          detailsPlaceholder="פרט את הפציעה"
          trainees={trainees}
        />

        <YesNoWithTrainees
          form={form}
          label="האם זיהית מגבלות פיזיות או צורך בשיפור ביצועים?"
          boolField="has_physical_limitations"
          traineeIdsField="limitations_trainee_ids"
          detailsField="limitations_details"
          detailsPlaceholder="פרט את המגבלות או הצורך בשיפור"
          trainees={trainees}
        />
      </CardContent>
    </Card>
  );
}

// Step 3: Trainee Positives & Wellbeing
function TraineePositivesStep({ form, trainees }: Omit<StepProps, "trainerName">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>הישגים ורווחה</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <YesNoWithTrainees
          form={form}
          label="האם זיהית הישגים יוצאי דופן או שיפור במיומנויות?"
          boolField="has_achievements"
          traineeIdsField="achievements_trainee_ids"
          detailsField="achievements_details"
          detailsPlaceholder="פרט את ההישגים או השיפורים"
          trainees={trainees}
        />

        <YesNoWithTrainees
          form={form}
          label="האם זיהית מתאמן במצב נפשי ירוד?"
          boolField="has_poor_mental_state"
          traineeIdsField="mental_state_trainee_ids"
          detailsField="mental_state_details"
          detailsPlaceholder="פרט את המצב הנפשי"
          trainees={trainees}
        />

        <YesNoWithTrainees
          form={form}
          label="האם מתאמן התלונן על איכות/משך/יחס באימון?"
          boolField="has_complaints"
          traineeIdsField="complaints_trainee_ids"
          detailsField="complaints_details"
          detailsPlaceholder="פרט את התלונה"
          trainees={trainees}
        />

        <YesNoWithTrainees
          form={form}
          label="האם היה מתאמן שלא קיבל מספיק תשומת לב?"
          boolField="has_insufficient_attention"
          traineeIdsField="insufficient_attention_trainee_ids"
          detailsField="insufficient_attention_details"
          detailsPlaceholder="פרט והסבר"
          trainees={trainees}
        />

        <YesNoWithTrainees
          form={form}
          label="האם זיהית מתאמן מתאים לשדרוג תוכנית PRO?"
          boolField="has_pro_candidates"
          traineeIdsField="pro_candidates_trainee_ids"
          detailsField="pro_candidates_details"
          detailsPlaceholder="פרט מדוע המתאמן מתאים לשדרוג"
          trainees={trainees}
        />
      </CardContent>
    </Card>
  );
}

// Step 4: Parents & Visitors
function ParentsVisitorsStep({ form }: { form: UseFormReturn<ShiftReportFormData> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>הורים ומבקרים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <YesNoWithText
          form={form}
          label="האם נתקלת בהורה שחיפש איש צוות?"
          boolField="has_parent_seeking_staff"
          detailsField="parent_seeking_details"
          detailsPlaceholder="פרט את ההורה ואת מי חיפש"
        />

        <YesNoWithText
          form={form}
          label="האם היו אנשים חיצוניים מחוץ לאזור הישיבה?"
          boolField="has_external_visitors"
          detailsField="external_visitors_details"
          detailsPlaceholder="פרט אילו הורים ואיפה היו"
        />

        <YesNoWithText
          form={form}
          label="האם הורים התלוננו או שאלו שאלות?"
          boolField="has_parent_complaints"
          detailsField="parent_complaints_details"
          detailsPlaceholder="פרט את ההורים ואת התלונות"
        />
      </CardContent>
    </Card>
  );
}

// Step 5: Facility
function FacilityStep({ form }: { form: UseFormReturn<ShiftReportFormData> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>מתקן</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <YesNoWithText
          form={form}
          label="האם עזבת את המתקן מסודר ונקי?"
          boolField="facility_left_clean"
          detailsField="facility_not_clean_reason"
          detailsPlaceholder="הסבר מדוע לא"
          invertedLabel
        />

        <YesNoWithText
          form={form}
          label="האם ניקית את המתקן כנדרש (ב׳/ד׳/ו׳)?"
          boolField="facility_cleaned_scheduled"
          detailsField="facility_not_cleaned_reason"
          detailsPlaceholder="הסבר מדוע לא"
          invertedLabel
        />
      </CardContent>
    </Card>
  );
}

interface ShiftReportStepContentProps {
  step: number;
  form: UseFormReturn<ShiftReportFormData>;
  trainees: TraineeOption[];
  trainerName: string;
}

export function ShiftReportStepContent({
  step,
  form,
  trainees,
  trainerName,
}: ShiftReportStepContentProps) {
  switch (step) {
    case 0:
      return <BasicInfoStep form={form} trainees={trainees} trainerName={trainerName} />;
    case 1:
      return <TraineeIssuesStep form={form} trainees={trainees} />;
    case 2:
      return <TraineePositivesStep form={form} trainees={trainees} />;
    case 3:
      return <ParentsVisitorsStep form={form} />;
    case 4:
      return <FacilityStep form={form} />;
    default:
      return null;
  }
}
