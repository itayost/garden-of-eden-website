"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Timer, Activity, Ruler, Brain, Zap } from "lucide-react";
import type { AssessmentFormData } from "@/lib/validations/assessment";
import type { PlayerAssessment } from "@/types/assessment";
import {
  ASSESSMENT_LABELS_HE,
  ASSESSMENT_UNITS,
  COORDINATION_OPTIONS,
  LEG_POWER_OPTIONS,
  BODY_STRUCTURE_OPTIONS,
} from "@/types/assessment";

// Step definitions
export const WIZARD_STEPS = [
  { key: "date", title: "תאריך", icon: Calendar },
  { key: "sprints", title: "ספרינט", icon: Timer },
  { key: "jumps", title: "ניתור", icon: Activity },
  { key: "agility", title: "זריזות וגמישות", icon: Ruler },
  { key: "categorical", title: "הערכות", icon: Activity },
  { key: "power", title: "כוח", icon: Zap },
  { key: "mental", title: "מנטלי", icon: Brain },
];

// Helper to get previous value for comparison
function getPreviousValue(
  previousAssessment: PlayerAssessment | null | undefined,
  fieldName: keyof PlayerAssessment
): string | null {
  if (!previousAssessment) return null;
  const value = previousAssessment[fieldName];
  if (value === null || value === undefined) return null;

  const unit = ASSESSMENT_UNITS[fieldName];
  if (typeof value === "number") {
    return unit ? `${value} ${unit}` : value.toString();
  }

  // Handle categorical values
  const categoricalMappings: Record<string, { value: string; label: string }[]> = {
    coordination: COORDINATION_OPTIONS,
    leg_power_technique: LEG_POWER_OPTIONS,
    body_structure: BODY_STRUCTURE_OPTIONS,
  };
  const options = categoricalMappings[fieldName];
  if (options) {
    return options.find(o => o.value === value)?.label || null;
  }

  return typeof value === "string" ? value : null;
}

// Shared field wrapper - reduces duplication across input types
interface AssessmentFieldProps {
  name: keyof AssessmentFormData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: (field: any) => React.ReactNode;
  truncatePrevious?: boolean;
  form: UseFormReturn<AssessmentFormData>;
  previousAssessment?: PlayerAssessment | null;
}

function AssessmentField({
  name,
  children,
  truncatePrevious = false,
  form,
  previousAssessment,
}: AssessmentFieldProps) {
  const previousValue = getPreviousValue(previousAssessment, name as keyof PlayerAssessment);

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{ASSESSMENT_LABELS_HE[name]}</FormLabel>
          {children(field)}
          {previousValue && (
            <FormDescription className={`text-xs ${truncatePrevious ? "line-clamp-2" : ""}`}>
              אחרון: {previousValue}
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Simplified input components using shared wrapper
interface NumberInputProps {
  name: keyof AssessmentFormData;
  step?: string;
  form: UseFormReturn<AssessmentFormData>;
  previousAssessment?: PlayerAssessment | null;
}

function NumberInput({ name, step: inputStep = "0.01", form, previousAssessment }: NumberInputProps) {
  return (
    <AssessmentField name={name} form={form} previousAssessment={previousAssessment}>
      {(field) => (
        <FormControl>
          <div className="relative">
            <Input
              type="number"
              step={inputStep}
              min="0"
              placeholder="---"
              className="pl-16"
              {...field}
              value={field.value ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                field.onChange(val === "" ? null : parseFloat(val) || null);
              }}
            />
            {ASSESSMENT_UNITS[name] && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {ASSESSMENT_UNITS[name]}
              </span>
            )}
          </div>
        </FormControl>
      )}
    </AssessmentField>
  );
}

interface SelectInputProps {
  name: keyof AssessmentFormData;
  options: { value: string; label: string }[];
  form: UseFormReturn<AssessmentFormData>;
  previousAssessment?: PlayerAssessment | null;
}

function SelectInput({ name, options, form, previousAssessment }: SelectInputProps) {
  return (
    <AssessmentField name={name} form={form} previousAssessment={previousAssessment}>
      {(field) => (
        <Select onValueChange={field.onChange} value={typeof field.value === "string" ? field.value : undefined}>
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="בחר..." />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </AssessmentField>
  );
}

interface TextareaInputProps {
  name: keyof AssessmentFormData;
  placeholder: string;
  form: UseFormReturn<AssessmentFormData>;
  previousAssessment?: PlayerAssessment | null;
}

function TextareaInput({ name, placeholder, form, previousAssessment }: TextareaInputProps) {
  return (
    <AssessmentField name={name} form={form} previousAssessment={previousAssessment} truncatePrevious>
      {(field) => (
        <FormControl>
          <Textarea
            placeholder={placeholder}
            className="min-h-[100px]"
            {...field}
            value={typeof field.value === "string" ? field.value : ""}
          />
        </FormControl>
      )}
    </AssessmentField>
  );
}

interface AssessmentStepContentProps {
  step: number;
  form: UseFormReturn<AssessmentFormData>;
  previousAssessment?: PlayerAssessment | null;
}

export function AssessmentStepContent({
  step,
  form,
  previousAssessment,
}: AssessmentStepContentProps) {
  // Render content based on step
  switch (step) {
    case 0: // Date
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              תאריך המבדק
            </CardTitle>
            <CardDescription>
              בחר את התאריך שבו בוצע המבדק
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="assessment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ASSESSMENT_LABELS_HE.assessment_date}</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="max-w-xs"
                      {...field}
                      value={typeof field.value === "string" ? field.value : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      );

    case 1: // Sprint Tests
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              מבדקי ספרינט
            </CardTitle>
            <CardDescription>
              הזן את זמני הספרינט בשניות (ערך נמוך = מהיר יותר)
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-6">
            <NumberInput name="sprint_5m" step="0.001" form={form} previousAssessment={previousAssessment} />
            <NumberInput name="sprint_10m" step="0.001" form={form} previousAssessment={previousAssessment} />
            <NumberInput name="sprint_20m" step="0.001" form={form} previousAssessment={previousAssessment} />
          </CardContent>
        </Card>
      );

    case 2: // Jump Tests
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              מבדקי ניתור
            </CardTitle>
            <CardDescription>
              הזן את מרחקי/גבהי הקפיצות בסנטימטרים
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-6">
            <NumberInput name="jump_2leg_distance" step="0.1" form={form} previousAssessment={previousAssessment} />
            <NumberInput name="jump_right_leg" step="0.1" form={form} previousAssessment={previousAssessment} />
            <NumberInput name="jump_left_leg" step="0.1" form={form} previousAssessment={previousAssessment} />
            <NumberInput name="jump_2leg_height" step="0.1" form={form} previousAssessment={previousAssessment} />
          </CardContent>
        </Card>
      );

    case 3: // Agility & Flexibility
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              זריזות וגמישות
            </CardTitle>
            <CardDescription>
              בלייז ספוט - מספר פגיעות בדקה, גמישות בסנטימטרים
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-6">
            <NumberInput name="blaze_spot_time" step="1" form={form} previousAssessment={previousAssessment} />
            <NumberInput name="flexibility_ankle" step="0.1" form={form} previousAssessment={previousAssessment} />
            <NumberInput name="flexibility_knee" step="0.1" form={form} previousAssessment={previousAssessment} />
            <NumberInput name="flexibility_hip" step="0.1" form={form} previousAssessment={previousAssessment} />
          </CardContent>
        </Card>
      );

    case 4: // Categorical Assessments
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              הערכות גופניות
            </CardTitle>
            <CardDescription>
              בחר את ההערכה המתאימה לכל קטגוריה
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-6">
            <SelectInput name="coordination" options={COORDINATION_OPTIONS} form={form} previousAssessment={previousAssessment} />
            <SelectInput name="leg_power_technique" options={LEG_POWER_OPTIONS} form={form} previousAssessment={previousAssessment} />
            <SelectInput name="body_structure" options={BODY_STRUCTURE_OPTIONS} form={form} previousAssessment={previousAssessment} />
          </CardContent>
        </Card>
      );

    case 5: // Power
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              כוח בעיטה
            </CardTitle>
            <CardDescription>
              תוצאת מבדק קייזר באחוזים (0-100%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NumberInput name="kick_power_kaiser" step="0.1" form={form} previousAssessment={previousAssessment} />
          </CardContent>
        </Card>
      );

    case 6: // Mental Notes
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              הערכה מנטלית והערות
            </CardTitle>
            <CardDescription>
              הוסף הערות על התחומים המנטליים
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <TextareaInput name="concentration_notes" placeholder="הערות על ריכוז..." form={form} previousAssessment={previousAssessment} />
            <TextareaInput name="decision_making_notes" placeholder="הערות על קבלת החלטות..." form={form} previousAssessment={previousAssessment} />
            <TextareaInput name="work_ethic_notes" placeholder="הערות על מוסר עבודה..." form={form} previousAssessment={previousAssessment} />
            <TextareaInput name="recovery_notes" placeholder="הערות על התאוששות..." form={form} previousAssessment={previousAssessment} />
            <TextareaInput name="nutrition_notes" placeholder="הערות על תזונה..." form={form} previousAssessment={previousAssessment} />
            <TextareaInput name="notes" placeholder="הערות כלליות נוספות..." form={form} previousAssessment={previousAssessment} />
          </CardContent>
        </Card>
      );

    default:
      return null;
  }
}
