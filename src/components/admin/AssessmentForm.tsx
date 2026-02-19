"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  assessmentSchema,
  type AssessmentFormData,
  DEFAULT_ASSESSMENT,
} from "@/lib/validations/assessment";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ProgressStepper } from "@/components/ui/progress-stepper";
import { AssessmentStepContent, WIZARD_STEPS } from "@/components/admin/AssessmentStepContent";
import { Loader2, ChevronLeft, ChevronRight, SkipForward, Check } from "lucide-react";
import { toast } from "sonner";
import type { PlayerAssessment } from "@/types/assessment";

interface AssessmentFormProps {
  userId: string;
  playerName: string;
  existingAssessment?: PlayerAssessment | null;
  previousAssessment?: PlayerAssessment | null;
}

// Helper to extract form values from existing assessment
function getDefaultValues(existingAssessment: PlayerAssessment | null | undefined): AssessmentFormData {
  if (!existingAssessment) {
    return DEFAULT_ASSESSMENT;
  }

  // Map assessment fields to form data (only fields that exist in both types)
  return {
    assessment_date: existingAssessment.assessment_date,
    sprint_5m: existingAssessment.sprint_5m,
    sprint_10m: existingAssessment.sprint_10m,
    sprint_20m: existingAssessment.sprint_20m,
    jump_2leg_distance: existingAssessment.jump_2leg_distance,
    jump_right_leg: existingAssessment.jump_right_leg,
    jump_left_leg: existingAssessment.jump_left_leg,
    jump_2leg_height: existingAssessment.jump_2leg_height,
    blaze_spot_time: existingAssessment.blaze_spot_time,
    flexibility_ankle: existingAssessment.flexibility_ankle,
    flexibility_knee: existingAssessment.flexibility_knee,
    flexibility_hip: existingAssessment.flexibility_hip,
    coordination: existingAssessment.coordination,
    leg_power_technique: existingAssessment.leg_power_technique,
    body_structure: existingAssessment.body_structure,
    kick_power_kaiser: existingAssessment.kick_power_kaiser,
    concentration_notes: existingAssessment.concentration_notes,
    decision_making_notes: existingAssessment.decision_making_notes,
    work_ethic_notes: existingAssessment.work_ethic_notes,
    recovery_notes: existingAssessment.recovery_notes,
    nutrition_notes: existingAssessment.nutrition_notes,
    notes: existingAssessment.notes,
  };
}

// Helper to convert form data to database format
function formDataToDbFormat(data: AssessmentFormData, userId: string, assessedBy: string) {
  return {
    user_id: userId,
    assessed_by: assessedBy,
    assessment_date: data.assessment_date ?? new Date().toISOString().split("T")[0],
    sprint_5m: data.sprint_5m ?? null,
    sprint_10m: data.sprint_10m ?? null,
    sprint_20m: data.sprint_20m ?? null,
    jump_2leg_distance: data.jump_2leg_distance ?? null,
    jump_right_leg: data.jump_right_leg ?? null,
    jump_left_leg: data.jump_left_leg ?? null,
    jump_2leg_height: data.jump_2leg_height ?? null,
    blaze_spot_time: data.blaze_spot_time ?? null,
    flexibility_ankle: data.flexibility_ankle ?? null,
    flexibility_knee: data.flexibility_knee ?? null,
    flexibility_hip: data.flexibility_hip ?? null,
    coordination: data.coordination,
    leg_power_technique: data.leg_power_technique,
    body_structure: data.body_structure,
    kick_power_kaiser: data.kick_power_kaiser ?? null,
    concentration_notes: data.concentration_notes ?? null,
    decision_making_notes: data.decision_making_notes ?? null,
    work_ethic_notes: data.work_ethic_notes ?? null,
    recovery_notes: data.recovery_notes ?? null,
    nutrition_notes: data.nutrition_notes ?? null,
    notes: data.notes ?? null,
  };
}

// Maps each wizard step index to the DB columns it owns.
// Partial updates use this to avoid sending nulls for unvisited steps.
const STEP_DB_FIELDS: Record<number, string[]> = {
  0: ["assessment_date"],
  1: ["sprint_5m", "sprint_10m", "sprint_20m"],
  2: ["jump_2leg_distance", "jump_right_leg", "jump_left_leg", "jump_2leg_height"],
  3: ["blaze_spot_time", "flexibility_ankle", "flexibility_knee", "flexibility_hip"],
  4: ["coordination", "leg_power_technique", "body_structure"],
  5: ["kick_power_kaiser"],
  6: ["concentration_notes", "decision_making_notes", "work_ethic_notes",
      "recovery_notes", "nutrition_notes", "notes"],
};

export function AssessmentForm({
  userId,
  playerName,
  existingAssessment,
  previousAssessment,
}: AssessmentFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [assessmentId, setAssessmentId] = useState<string | null>(
    existingAssessment?.id ?? null
  );
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const form = useForm<AssessmentFormData>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: getDefaultValues(existingAssessment),
  });

  // Save current step data
  const saveStep = useCallback(async () => {
    setSaving(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("נא להתחבר מחדש");
      }

      const data = form.getValues();
      const assessmentData = formDataToDbFormat(data, userId, user.id);

      if (assessmentId) {
        // Partial update: only send this step's fields so unvisited steps
        // never overwrite existing DB values with nulls.
        const stepFields = STEP_DB_FIELDS[currentStep];
        if (!stepFields) {
          throw new Error(`שלב ${currentStep} אינו ממופה — לא ניתן לשמור`);
        }
        type DbData = ReturnType<typeof formDataToDbFormat>;
        const partialData: Record<string, unknown> = { assessed_by: user.id };
        for (const field of stepFields) {
          partialData[field] = assessmentData[field as keyof DbData];
        }

        const { error } = await typedFrom(supabase, "player_assessments")
          .update(partialData)
          .eq("id", assessmentId);

        if (error) throw error;
      } else {
        // Create new assessment (first step)
        const { data: newAssessment, error } = await typedFrom(supabase, "player_assessments")
          .insert(assessmentData)
          .select("id")
          .single();

        if (error) throw error;
        if (newAssessment) {
          setAssessmentId(newAssessment.id);
        }
      }

      // Mark step as completed (Set handles duplicates automatically)
      setCompletedSteps((prev) => {
        if (prev.has(currentStep)) return prev;
        return new Set([...prev, currentStep]);
      });
      return true;
    } catch (error: unknown) {
      console.error("Save error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "שגיאה בשמירת המבדק";
      toast.error(errorMessage);
      return false;
    } finally {
      setSaving(false);
    }
  }, [assessmentId, currentStep, form, userId]);

  // Navigate to next step
  const handleNext = async () => {
    const saved = await saveStep();
    if (saved && currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      toast.success("נשמר בהצלחה");
    }
  };

  // Skip current step
  const handleSkip = async () => {
    const saved = await saveStep();
    if (saved && currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  // Navigate to previous step
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Navigate to specific step (free navigation once first step is saved)
  const handleStepClick = (stepIndex: number) => {
    // Allow navigation only to current, past, or completed steps
    if (assessmentId || stepIndex === 0) {
      if (stepIndex <= currentStep || completedSteps.has(stepIndex)) {
        setCurrentStep(stepIndex);
      }
    }
  };

  // Finish assessment
  const handleFinish = async () => {
    const saved = await saveStep();
    if (saved) {
      toast.success("המבדק נשמר בהצלחה!");
      router.push(`/admin/assessments/${userId}`);
    }
  };

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">
            מבדק {existingAssessment ? "קיים" : "חדש"} עבור {playerName}
          </h2>

          {/* Progress Stepper */}
          <ProgressStepper
            steps={WIZARD_STEPS.map((s) => ({ key: s.key, title: s.title }))}
            currentStep={currentStep}
            onStepClick={handleStepClick}
            completedSteps={completedSteps}
          />
        </div>

        {/* Step Content */}
        <AssessmentStepContent
          step={currentStep}
          form={form}
          previousAssessment={previousAssessment}
        />

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t">
          {/* Left side - Previous */}
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={isFirstStep || saving}
          >
            <ChevronRight className="h-4 w-4 ml-2" />
            הקודם
          </Button>

          {/* Right side - Skip/Next/Finish */}
          <div className="flex items-center gap-2">
            {!isLastStep && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkip}
                disabled={saving}
              >
                <SkipForward className="h-4 w-4 ml-2" />
                דלג
              </Button>
            )}

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
