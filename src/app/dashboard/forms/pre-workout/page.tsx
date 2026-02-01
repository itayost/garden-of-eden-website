"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { preWorkoutSchema, type PreWorkoutFormData, type PreWorkoutFormInput } from "@/lib/validations/forms";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
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
import { useFormDraft } from "@/features/form-drafts";
import { useFormSubmission, fetchUserProfile, calculateAge } from "@/hooks/useFormSubmission";
import { FormBackButton, FormSubmitButton } from "@/components/forms";

const defaultValues: PreWorkoutFormInput = {
  group_training: "",
  urine_color: "",
  nutrition_status: "",
  last_game: "",
  improvements_desired: "",
  sleep_hours: "",
  recent_injury: "",
  next_match: "",
};

export default function PreWorkoutFormPage() {
  const form = useForm<PreWorkoutFormInput>({
    resolver: zodResolver(preWorkoutSchema),
    defaultValues,
  });

  // Enable draft saving with auto-restore
  const draft = useFormDraft(form, { formId: "pre-workout" }, defaultValues);

  // Form submission with shared hook
  const { loading, onSubmit } = useFormSubmission<PreWorkoutFormData>({
    tableName: "pre_workout_forms",
    successMessage: "השאלון נשלח בהצלחה!",
    redirectPath: "/dashboard",
    onSuccess: () => draft.clearDraft(),
    transformData: async (data, userId) => {
      const profile = await fetchUserProfile(userId);
      return {
        user_id: userId,
        full_name: profile?.full_name || "לא צוין",
        age: calculateAge(profile?.birthdate ?? null),
        ...data,
      };
    },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <FormBackButton />

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">שאלון לפני אימון</CardTitle>
          <CardDescription>
            אנחנו נשמח לשמוע איך אתה מרגיש כדי שנגיע הכי מוכנים לאימון
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="group_training"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>האם יש לך אימון קבוצתי היום?</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר תשובה" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="before">כן, לפני האימון</SelectItem>
                        <SelectItem value="after">כן, אחרי האימון</SelectItem>
                        <SelectItem value="no">לא</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="urine_color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מה צבע השתן שלך היום?</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר צבע" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="clear">שקוף</SelectItem>
                        <SelectItem value="light_yellow">צהוב בהיר</SelectItem>
                        <SelectItem value="dark_yellow">צהוב כהה</SelectItem>
                        <SelectItem value="unknown">לא יודע</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nutrition_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>האם אכלת מספיק לפני האימון?</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר תשובה" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="full_energy">בהחלט, מלא אנרגיה</SelectItem>
                        <SelectItem value="insufficient">לא הספיק, אשלים אחרי האימון</SelectItem>
                        <SelectItem value="no_energy">אין אנרגיה, מעדיף אימון קל</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sleep_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>כמה שעות ישנת אתמול?</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר טווח" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="4-6">4-6 שעות (איכות ירודה)</SelectItem>
                        <SelectItem value="6-8">6-8 שעות (סביר)</SelectItem>
                        <SelectItem value="8-11">8-11 שעות (טוב)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_game"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מתי היה המשחק האחרון שלך וכמה זמן שיחקת?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="לדוגמה: ביום שישי, שיחקתי 60 דקות"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recent_injury"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>האם יש פציעה כרגע?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="תאר את הפציעה אם יש, או כתוב 'אין'"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="next_match"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מתי המשחק הבא שלך?</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר תשובה" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="this_weekend">הסוף שבוע הזה</SelectItem>
                        <SelectItem value="next_weekend">הסוף שבוע הבא</SelectItem>
                        <SelectItem value="midweek">באמצע השבוע</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="improvements_desired"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>במה היית רוצה להשתפר באימון היום?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="ספר לנו על מה היית רוצה לעבוד"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormSubmitButton loading={loading} />
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
