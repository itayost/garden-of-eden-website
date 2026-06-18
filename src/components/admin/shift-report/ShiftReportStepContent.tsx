"use client";

import { memo } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
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
import { type TraineeOption } from "./TraineeMultiSelect";
import {
  PerTraineeCategoriesSection,
  PerTraineeDetailsSection,
} from "./PerTraineeSections";
import type { ShiftReportFormData } from "@/lib/validations/shift-report";

export const SHIFT_REPORT_STEPS = [
  { key: "basic", title: "מידע בסיסי" },
  { key: "issues", title: "בעיות מתאמנים" },
  { key: "positives", title: "הישגים ורווחה" },
  { key: "parents", title: "הורים ומבקרים" },
  { key: "facility", title: "מתקן" },
  { key: "communication", title: "תקשורת עם מתאמנים והורים" },
];

interface StepProps {
  form: UseFormReturn<ShiftReportFormData>;
  trainees: TraineeOption[];
  trainerName: string;
}

interface YesNoWithTextProps {
  form: UseFormReturn<ShiftReportFormData>;
  label: string;
  boolField: keyof ShiftReportFormData;
  detailsField: keyof ShiftReportFormData;
  detailsPlaceholder: string;
  /** If true, show details when answer is "no" (e.g. facility questions) */
  invertedLabel?: boolean;
}

/** Reusable yes/no question with conditional text only (no trainee select) */
const YesNoWithText = memo(function YesNoWithText({
  form,
  label,
  boolField,
  detailsField,
  detailsPlaceholder,
  invertedLabel,
}: YesNoWithTextProps) {
  const value = useWatch({ control: form.control, name: boolField }) as boolean;
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
});

const BasicInfoStep = memo(function BasicInfoStep({
  form,
  trainees,
  trainerName,
}: StepProps) {
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

        <PerTraineeDetailsSection
          form={form}
          trainees={trainees}
          label="האם אימנת מתאמנים חדשים?"
          boolField="trained_new_trainees"
          traineeIdsField="new_trainees_ids"
          perTraineeField="new_trainees_per_trainee"
          detailsPlaceholder="פרט את התקדמות האימון של המתאמן"
        />
      </CardContent>
    </Card>
  );
});

const TraineeIssuesStep = memo(function TraineeIssuesStep({
  form,
  trainees,
}: Omit<StepProps, "trainerName">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>בעיות מתאמנים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <PerTraineeDetailsSection
          form={form}
          trainees={trainees}
          label="האם הייתה בעיית משמעת עם מתאמן?"
          boolField="has_discipline_issues"
          traineeIdsField="discipline_trainee_ids"
          perTraineeField="discipline_per_trainee"
          detailsPlaceholder="פרט את בעיית המשמעת של המתאמן"
        />

        <PerTraineeDetailsSection
          form={form}
          trainees={trainees}
          label="האם זיהית או שמעת על פציעה של מתאמן?"
          boolField="has_injuries"
          traineeIdsField="injuries_trainee_ids"
          perTraineeField="injuries_per_trainee"
          detailsPlaceholder="פרט את הפציעה של המתאמן"
        />

        <PerTraineeDetailsSection
          form={form}
          trainees={trainees}
          label="האם זיהית מגבלות פיזיות או צורך בשיפור ביצועים?"
          boolField="has_physical_limitations"
          traineeIdsField="limitations_trainee_ids"
          perTraineeField="limitations_per_trainee"
          detailsPlaceholder="פרט את המגבלות או הצורך בשיפור של המתאמן"
        />

        <PerTraineeCategoriesSection
          form={form}
          trainees={trainees}
          label="האם עבדת על נושאים ספציפיים עם מתאמנים היום?"
          boolField="has_worked_on_focus"
          traineeIdsField="worked_on_trainee_ids"
          perTraineeField="worked_on_per_trainee"
          categoriesLabel="על מה עבדת עם המתאמן"
          detailsPlaceholder="פרט על מה עבדת עם המתאמן היום"
        />
      </CardContent>
    </Card>
  );
});

const TraineePositivesStep = memo(function TraineePositivesStep({
  form,
  trainees,
}: Omit<StepProps, "trainerName">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>הישגים ורווחה</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <PerTraineeCategoriesSection
          form={form}
          trainees={trainees}
          label="האם זיהית הישגים יוצאי דופן או שיפור במיומנויות?"
          boolField="has_achievements"
          traineeIdsField="achievements_trainee_ids"
          perTraineeField="achievements_per_trainee"
          categoriesLabel="קטגוריות הצטיינות"
          detailsPlaceholder="פרט את ההישגים או השיפורים"
        />

        <PerTraineeDetailsSection
          form={form}
          trainees={trainees}
          label="האם זיהית מתאמן במצב נפשי ירוד?"
          boolField="has_poor_mental_state"
          traineeIdsField="mental_state_trainee_ids"
          perTraineeField="mental_state_per_trainee"
          detailsPlaceholder="פרט את המצב הנפשי של המתאמן"
        />

        <PerTraineeDetailsSection
          form={form}
          trainees={trainees}
          label="האם מתאמן התלונן על איכות/משך/יחס באימון?"
          boolField="has_complaints"
          traineeIdsField="complaints_trainee_ids"
          perTraineeField="complaints_per_trainee"
          detailsPlaceholder="פרט את התלונה של המתאמן"
        />

        <PerTraineeDetailsSection
          form={form}
          trainees={trainees}
          label="האם היה מתאמן שלא קיבל מספיק תשומת לב?"
          boolField="has_insufficient_attention"
          traineeIdsField="insufficient_attention_trainee_ids"
          perTraineeField="insufficient_attention_per_trainee"
          detailsPlaceholder="פרט והסבר לגבי המתאמן"
        />

        <PerTraineeDetailsSection
          form={form}
          trainees={trainees}
          label="האם זיהית מתאמן מתאים לשדרוג תוכנית PRO?"
          boolField="has_pro_candidates"
          traineeIdsField="pro_candidates_trainee_ids"
          perTraineeField="pro_candidates_per_trainee"
          detailsPlaceholder="פרט מדוע המתאמן מתאים לשדרוג"
        />

        <PerTraineeDetailsSection
          form={form}
          trainees={trainees}
          label="האם יש שחקנים שהפגינו כישורים חברתיים בולטים?"
          boolField="has_social_skills"
          traineeIdsField="social_skills_trainee_ids"
          perTraineeField="social_skills_per_trainee"
          detailsPlaceholder="פרט את הכישורים החברתיים שזיהית אצל המתאמן"
        />
      </CardContent>
    </Card>
  );
});

const ParentsVisitorsStep = memo(function ParentsVisitorsStep({
  form,
}: {
  form: UseFormReturn<ShiftReportFormData>;
}) {
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
});

const FacilityStep = memo(function FacilityStep({
  form,
}: {
  form: UseFormReturn<ShiftReportFormData>;
}) {
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
});

const CommunicationStep = memo(function CommunicationStep({
  form,
  trainees,
}: Omit<StepProps, "trainerName">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>תקשורת עם מתאמנים והורים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <PerTraineeDetailsSection
          form={form}
          trainees={trainees}
          label="לאיזה שחקנים שלחת הודעה לשיעורי בית? (שחקן אחד מכל שעת אימון)"
          boolField="has_homework"
          traineeIdsField="homework_trainee_ids"
          perTraineeField="homework_per_trainee"
          detailsPlaceholder="איזה נושא/תרגיל נשלח לשחקן"
        />

        <PerTraineeDetailsSection
          form={form}
          trainees={trainees}
          label="לאיזה הורים של שחקנים שלחת צילום וידאו של התרגיל כפידבק חיובי? (צילום אחד בכל שעה)"
          boolField="has_video_feedback"
          traineeIdsField="video_feedback_trainee_ids"
          perTraineeField="video_feedback_per_trainee"
          detailsPlaceholder="איזה תרגיל ביצע השחקן"
        />

        <PerTraineeDetailsSection
          form={form}
          trainees={trainees}
          label="לאיזה מתאמנים שלחת הודעת פרגון על אופי/התנהלות/התמדה? (הודעה אחת בכל שעת אימון)"
          boolField="has_praise"
          traineeIdsField="praise_trainee_ids"
          perTraineeField="praise_per_trainee"
          detailsPlaceholder="תוכן הפרגון שנשלח למתאמן"
        />
      </CardContent>
    </Card>
  );
});

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
    case 5:
      return <CommunicationStep form={form} trainees={trainees} />;
    default:
      return null;
  }
}
