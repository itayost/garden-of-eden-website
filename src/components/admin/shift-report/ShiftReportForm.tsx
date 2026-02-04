"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  shiftReportSchema,
  type ShiftReportFormData,
  DEFAULT_SHIFT_REPORT,
} from "@/lib/validations/shift-report";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ProgressStepper } from "@/components/ui/progress-stepper";
import {
  ShiftReportStepContent,
  SHIFT_REPORT_STEPS,
} from "./ShiftReportStepContent";
import { Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { useFormDraft } from "@/features/form-drafts";
import type { TraineeOption } from "./TraineeMultiSelect";
import type { TrainerShiftReport } from "@/types/database";

interface ShiftReportFormProps {
  trainerId: string;
  trainerName: string;
  trainees: TraineeOption[];
  existingReport?: TrainerShiftReport | null;
}

function reportToFormData(report: TrainerShiftReport): ShiftReportFormData {
  return {
    report_date: report.report_date,
    trained_new_trainees: report.trained_new_trainees,
    new_trainees_ids: report.new_trainees_ids || [],
    new_trainees_details: report.new_trainees_details || "",
    has_discipline_issues: report.has_discipline_issues,
    discipline_trainee_ids: report.discipline_trainee_ids || [],
    discipline_details: report.discipline_details || "",
    has_injuries: report.has_injuries,
    injuries_trainee_ids: report.injuries_trainee_ids || [],
    injuries_details: report.injuries_details || "",
    has_physical_limitations: report.has_physical_limitations,
    limitations_trainee_ids: report.limitations_trainee_ids || [],
    limitations_details: report.limitations_details || "",
    has_achievements: report.has_achievements,
    achievements_trainee_ids: report.achievements_trainee_ids || [],
    achievements_details: report.achievements_details || "",
    has_poor_mental_state: report.has_poor_mental_state,
    mental_state_trainee_ids: report.mental_state_trainee_ids || [],
    mental_state_details: report.mental_state_details || "",
    has_complaints: report.has_complaints,
    complaints_trainee_ids: report.complaints_trainee_ids || [],
    complaints_details: report.complaints_details || "",
    has_insufficient_attention: report.has_insufficient_attention,
    insufficient_attention_trainee_ids: report.insufficient_attention_trainee_ids || [],
    insufficient_attention_details: report.insufficient_attention_details || "",
    has_pro_candidates: report.has_pro_candidates,
    pro_candidates_trainee_ids: report.pro_candidates_trainee_ids || [],
    pro_candidates_details: report.pro_candidates_details || "",
    has_parent_seeking_staff: report.has_parent_seeking_staff,
    parent_seeking_details: report.parent_seeking_details || "",
    has_external_visitors: report.has_external_visitors,
    external_visitors_details: report.external_visitors_details || "",
    has_parent_complaints: report.has_parent_complaints,
    parent_complaints_details: report.parent_complaints_details || "",
    facility_left_clean: report.facility_left_clean,
    facility_not_clean_reason: report.facility_not_clean_reason || "",
    facility_cleaned_scheduled: report.facility_cleaned_scheduled,
    facility_not_cleaned_reason: report.facility_not_cleaned_reason || "",
  };
}

export function ShiftReportForm({
  trainerId,
  trainerName,
  trainees,
  existingReport,
}: ShiftReportFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [reportId, setReportId] = useState<string | null>(
    existingReport?.id || null
  );
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    existingReport ? new Set([0, 1, 2, 3, 4]) : new Set()
  );
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const defaultValues = existingReport
    ? reportToFormData(existingReport)
    : DEFAULT_SHIFT_REPORT;

  const form = useForm<ShiftReportFormData>({
    resolver: zodResolver(shiftReportSchema),
    defaultValues,
  });

  // Auto-save draft (only for new reports without existing data)
  const draft = useFormDraft(
    form,
    { formId: "shift-report" },
    DEFAULT_SHIFT_REPORT
  );

  const saveStep = useCallback(async () => {
    setSaving(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("נא להתחבר מחדש");
      }

      const data = form.getValues();
      const reportData = {
        trainer_id: trainerId,
        trainer_name: trainerName,
        ...data,
        // Convert empty strings to null for text fields
        new_trainees_details: data.new_trainees_details || null,
        discipline_details: data.discipline_details || null,
        injuries_details: data.injuries_details || null,
        limitations_details: data.limitations_details || null,
        achievements_details: data.achievements_details || null,
        mental_state_details: data.mental_state_details || null,
        complaints_details: data.complaints_details || null,
        insufficient_attention_details: data.insufficient_attention_details || null,
        pro_candidates_details: data.pro_candidates_details || null,
        parent_seeking_details: data.parent_seeking_details || null,
        external_visitors_details: data.external_visitors_details || null,
        parent_complaints_details: data.parent_complaints_details || null,
        facility_not_clean_reason: data.facility_not_clean_reason || null,
        facility_not_cleaned_reason: data.facility_not_cleaned_reason || null,
      };

      if (reportId) {
        // Update existing report
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("trainer_shift_reports")
          .update(reportData)
          .eq("id", reportId);

        if (error) throw error;
      } else {
        // Create new report
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newReport, error } = await (supabase as any)
          .from("trainer_shift_reports")
          .insert(reportData)
          .select("id")
          .single();

        if (error) throw error;
        if (newReport) {
          setReportId(newReport.id);
        }
      }

      setCompletedSteps((prev) => {
        if (prev.has(currentStep)) return prev;
        return new Set([...prev, currentStep]);
      });
      return true;
    } catch (error: unknown) {
      console.error("Save error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "שגיאה בשמירת הדוח";
      toast.error(errorMessage);
      return false;
    } finally {
      setSaving(false);
    }
  }, [reportId, currentStep, form, trainerId, trainerName]);

  const handleNext = async () => {
    if (saving) return;
    const saved = await saveStep();
    if (saved && currentStep < SHIFT_REPORT_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      toast.success("נשמר בהצלחה");
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    if (reportId || stepIndex === 0) {
      if (stepIndex <= currentStep || completedSteps.has(stepIndex)) {
        setCurrentStep(stepIndex);
      }
    }
  };

  const handleFinish = async () => {
    if (saving) return;
    const saved = await saveStep();
    if (saved) {
      draft.clearDraft();
      toast.success("הדוח נשמר בהצלחה!");
      router.push("/admin/submissions?tab=shift-reports");
    }
  };

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === SHIFT_REPORT_STEPS.length - 1;

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">
            דוח סוף משמרת{existingReport ? " (עריכה)" : ""}
          </h2>

          <ProgressStepper
            steps={SHIFT_REPORT_STEPS.map((s) => ({ key: s.key, title: s.title }))}
            currentStep={currentStep}
            onStepClick={handleStepClick}
            completedSteps={completedSteps}
          />
        </div>

        {/* Step Content */}
        <ShiftReportStepContent
          step={currentStep}
          form={form}
          trainees={trainees}
          trainerName={trainerName}
        />

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={isFirstStep || saving}
          >
            <ChevronRight className="h-4 w-4 ml-2" />
            הקודם
          </Button>

          <div className="flex items-center gap-2">
            {isLastStep ? (
              <Button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="min-w-[120px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    שומר...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 ml-2" />
                    סיום
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleNext}
                disabled={saving}
                className="min-w-[120px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    שומר...
                  </>
                ) : (
                  <>
                    המשך
                    <ChevronLeft className="h-4 w-4 mr-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
