"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  assessmentSchema,
  type AssessmentFormData,
  DEFAULT_ASSESSMENT,
} from "@/lib/validations/assessment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
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
import { Loader2, Save, Timer, Target, Activity, Brain } from "lucide-react";
import { toast } from "sonner";
import {
  ASSESSMENT_LABELS_HE,
  ASSESSMENT_UNITS,
  COORDINATION_OPTIONS,
  LEG_POWER_OPTIONS,
  BODY_STRUCTURE_OPTIONS,
} from "@/types/assessment";
import type { PlayerAssessment } from "@/types/assessment";

interface AssessmentFormProps {
  userId: string;
  playerName: string;
  existingAssessment?: PlayerAssessment | null;
}

export function AssessmentForm({
  userId,
  playerName,
  existingAssessment,
}: AssessmentFormProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const defaultValues: AssessmentFormData = existingAssessment
    ? {
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
      }
    : DEFAULT_ASSESSMENT;

  const form = useForm<AssessmentFormData>({
    resolver: zodResolver(assessmentSchema),
    defaultValues,
  });

  const onSubmit = async (data: AssessmentFormData) => {
    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("נא להתחבר מחדש");
      }

      const assessmentData = {
        user_id: userId,
        assessment_date: data.assessment_date || new Date().toISOString().split("T")[0],
        sprint_5m: data.sprint_5m || null,
        sprint_10m: data.sprint_10m || null,
        sprint_20m: data.sprint_20m || null,
        jump_2leg_distance: data.jump_2leg_distance || null,
        jump_right_leg: data.jump_right_leg || null,
        jump_left_leg: data.jump_left_leg || null,
        jump_2leg_height: data.jump_2leg_height || null,
        blaze_spot_time: data.blaze_spot_time || null,
        flexibility_ankle: data.flexibility_ankle || null,
        flexibility_knee: data.flexibility_knee || null,
        flexibility_hip: data.flexibility_hip || null,
        coordination: data.coordination || null,
        leg_power_technique: data.leg_power_technique || null,
        body_structure: data.body_structure || null,
        kick_power_kaiser: data.kick_power_kaiser || null,
        concentration_notes: data.concentration_notes || null,
        decision_making_notes: data.decision_making_notes || null,
        work_ethic_notes: data.work_ethic_notes || null,
        recovery_notes: data.recovery_notes || null,
        nutrition_notes: data.nutrition_notes || null,
        notes: data.notes || null,
        assessed_by: user.id,
      };

      if (existingAssessment) {
        // Update existing assessment - use type assertion due to Supabase client typing
        const { error } = await (supabase
          .from("player_assessments") as ReturnType<typeof supabase.from>)
          .update(assessmentData as Record<string, unknown>)
          .eq("id", existingAssessment.id);

        if (error) throw error;
        toast.success("המבדק עודכן בהצלחה!");
      } else {
        // Create new assessment - use type assertion due to Supabase client typing
        const { error } = await (supabase
          .from("player_assessments") as ReturnType<typeof supabase.from>)
          .insert(assessmentData as Record<string, unknown>);

        if (error) throw error;
        toast.success("המבדק נשמר בהצלחה!");
      }

      router.push(`/admin/assessments/${userId}`);
      router.refresh();
    } catch (error: unknown) {
      console.error("Submit error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "שגיאה בשמירת המבדק";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper to render number input with unit
  const NumberInput = ({
    name,
    step = "0.01",
  }: {
    name: keyof AssessmentFormData;
    step?: string;
  }) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{ASSESSMENT_LABELS_HE[name]}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type="number"
                step={step}
                placeholder="---"
                className="pl-16"
                {...field}
                value={field.value ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  field.onChange(val === "" ? null : parseFloat(val));
                }}
              />
              {ASSESSMENT_UNITS[name] && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {ASSESSMENT_UNITS[name]}
                </span>
              )}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header with player name */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              מבדק חדש עבור {playerName}
            </CardTitle>
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
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Sprint Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              מבדקי ספרינט
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <NumberInput name="sprint_5m" step="0.001" />
            <NumberInput name="sprint_10m" step="0.001" />
            <NumberInput name="sprint_20m" step="0.001" />
          </CardContent>
        </Card>

        {/* Jump Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              מבדקי ניתור
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <NumberInput name="jump_2leg_distance" step="0.1" />
            <NumberInput name="jump_right_leg" step="0.1" />
            <NumberInput name="jump_left_leg" step="0.1" />
            <NumberInput name="jump_2leg_height" step="0.1" />
          </CardContent>
        </Card>

        {/* Agility & Flexibility */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              זריזות וגמישות
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <NumberInput name="blaze_spot_time" step="0.01" />
            <NumberInput name="flexibility_ankle" step="0.1" />
            <NumberInput name="flexibility_knee" step="0.1" />
            <NumberInput name="flexibility_hip" step="0.1" />
          </CardContent>
        </Card>

        {/* Categorical Assessments */}
        <Card>
          <CardHeader>
            <CardTitle>הערכות</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="coordination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ASSESSMENT_LABELS_HE.coordination}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COORDINATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="leg_power_technique"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ASSESSMENT_LABELS_HE.leg_power_technique}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEG_POWER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body_structure"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ASSESSMENT_LABELS_HE.body_structure}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BODY_STRUCTURE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Kick Power */}
        <Card>
          <CardHeader>
            <CardTitle>כוח בעיטה</CardTitle>
          </CardHeader>
          <CardContent>
            <NumberInput name="kick_power_kaiser" step="0.1" />
            <FormDescription className="mt-2">
              אחוז מבדק קייזר (0-100%)
            </FormDescription>
          </CardContent>
        </Card>

        {/* Mental Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              הערכה מנטלית
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="concentration_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ASSESSMENT_LABELS_HE.concentration_notes}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="הערות על ריכוז..."
                      className="min-h-[80px]"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="decision_making_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ASSESSMENT_LABELS_HE.decision_making_notes}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="הערות על קבלת החלטות..."
                      className="min-h-[80px]"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="work_ethic_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ASSESSMENT_LABELS_HE.work_ethic_notes}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="הערות על מוסר עבודה..."
                      className="min-h-[80px]"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recovery_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ASSESSMENT_LABELS_HE.recovery_notes}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="הערות על התאוששות..."
                      className="min-h-[80px]"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nutrition_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ASSESSMENT_LABELS_HE.nutrition_notes}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="הערות על תזונה..."
                      className="min-h-[80px]"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* General Notes */}
        <Card>
          <CardHeader>
            <CardTitle>הערות כלליות</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="הערות נוספות על המבדק..."
                      className="min-h-[100px]"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="ml-2 h-5 w-5 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Save className="ml-2 h-5 w-5" />
              {existingAssessment ? "עדכון מבדק" : "שמירת מבדק"}
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
