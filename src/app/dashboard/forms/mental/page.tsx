"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  mentalQuestionnaireSchema,
  type MentalQuestionnaireFormData,
  type MentalQuestionnaireFormInput,
} from "@/lib/validations/forms";
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
import { useFormSubmission, fetchUserProfile } from "@/hooks/useFormSubmission";
import { FormBackButton, FormSubmitButton } from "@/components/forms";

const getDefaultValues = (): MentalQuestionnaireFormInput => ({
  last_session_conclusion: "",
  mental_insight: "",
  tool_to_take: "",
  wants_more_zoom: false,
  zoom_feeling: "",
  wants_one_on_one: false,
});

export default function MentalQuestionnairePage() {
  const defaultValues = getDefaultValues();

  const form = useForm<MentalQuestionnaireFormInput>({
    resolver: zodResolver(mentalQuestionnaireSchema),
    defaultValues,
  });

  const draft = useFormDraft(form, { formId: "mental" }, defaultValues);

  const { loading, onSubmit } = useFormSubmission<MentalQuestionnaireFormData>({
    tableName: "mental_questionnaires",
    successMessage: "השאלון נשלח בהצלחה! תודה על המשוב",
    redirectPath: "/dashboard",
    onSuccess: () => draft.clearDraft(),
    transformData: async (data, userId) => {
      const profile = await fetchUserProfile(userId);
      return {
        user_id: userId,
        full_name: profile?.full_name || "לא צוין",
        ...data,
      };
    },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="sr-only">שאלון מנטלי</h1>
      <FormBackButton />

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">שאלון מנטלי</CardTitle>
          <CardDescription>
            שתפו אותנו במשוב מהאימון המנטלי / מפגש הזום עם עומר
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="last_session_conclusion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מסקנה מהאימון המנטלי האחרון שלך?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="מה לקחת מהאימון האחרון..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mental_insight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מה חידשנו לך בעניין המנטלי?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="רעיון, תובנה, או נקודה חדשה שלמדת..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tool_to_take"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>איזה כלי תיקח איתך להמשך?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="כלי או טכניקה שתיישם בהמשך..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="wants_more_zoom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>האם היית רוצה יותר מפגשי זום?</FormLabel>
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
                        <SelectItem value="true">כן</SelectItem>
                        <SelectItem value="false">לא</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zoom_feeling"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>איך הרגשת בתוך הזום?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="תיאור התחושה במהלך המפגש..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="wants_one_on_one"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>האם תרצה ליווי מנטלי 1 על 1 עם עומר?</FormLabel>
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
                        <SelectItem value="true">כן</SelectItem>
                        <SelectItem value="false">לא</SelectItem>
                      </SelectContent>
                    </Select>
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
