"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { postWorkoutSchema, type PostWorkoutFormData, type PostWorkoutFormInput } from "@/lib/validations/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { Trainer } from "@/types/database";
import { useFormDraft } from "@/features/form-drafts";
import { useFormSubmission, fetchUserProfile } from "@/hooks/useFormSubmission";
import { FormBackButton, FormSubmitButton } from "@/components/forms";

const getDefaultValues = (): PostWorkoutFormInput => ({
  training_date: new Date().toISOString().split("T")[0],
  trainer_id: "",
  difficulty_level: 5,
  satisfaction_level: 5,
  comments: "",
  contact_info: "",
});

export default function PostWorkoutFormPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);

  const defaultValues = getDefaultValues();

  const form = useForm<PostWorkoutFormInput>({
    resolver: zodResolver(postWorkoutSchema),
    defaultValues,
  });

  // Enable draft saving with auto-restore
  const draft = useFormDraft(form, { formId: "post-workout" }, defaultValues);

  // Form submission with shared hook
  const { loading, onSubmit } = useFormSubmission<PostWorkoutFormData>({
    tableName: "post_workout_forms",
    successMessage: "השאלון נשלח בהצלחה! תודה על המשוב",
    redirectPath: "/dashboard",
    onSuccess: () => draft.clearDraft(),
    transformData: async (data, userId) => {
      const profile = await fetchUserProfile(userId);
      return {
        user_id: userId,
        full_name: profile?.full_name || "לא צוין",
        ...data,
        trainer_id: data.trainer_id || null,
      };
    },
  });

  useEffect(() => {
    const fetchTrainers = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trainers")
        .select("*")
        .eq("active", true)
        .order("name") as unknown as { data: Trainer[] | null; error: unknown };

      if (error) {
        toast.error("שגיאה בטעינת רשימת המאמנים");
      } else if (data) {
        setTrainers(data);
      }
    };

    fetchTrainers();
  }, []);

  // eslint-disable-next-line react-hooks/incompatible-library
  const difficultyValue = form.watch("difficulty_level");
  const satisfactionValue = form.watch("satisfaction_level");

  return (
    <div className="max-w-2xl mx-auto">
      <FormBackButton />

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">שאלון אחרי אימון</CardTitle>
          <CardDescription>
            ספרו לנו איך היה האימון - המשוב שלכם עוזר לנו להשתפר
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="training_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תאריך האימון *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trainer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מי המאמן שאימן אותך היום?</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר מאמן" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trainers.map((trainer) => (
                          <SelectItem key={trainer.id} value={trainer.id}>
                            {trainer.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="unknown">לא זוכר</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="difficulty_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>רמת הקושי של האימון (1-10)</FormLabel>
                    <FormDescription>
                      1 = קל מאוד, 10 = קשה מאוד
                    </FormDescription>
                    <FormControl>
                      <div className="space-y-3">
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>קל מאוד</span>
                          <span className="font-bold text-lg text-primary">{difficultyValue}</span>
                          <span>קשה מאוד</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="satisfaction_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שביעות רצון מהאימון (1-10) *</FormLabel>
                    <FormDescription>
                      1 = לא מרוצה בכלל, 10 = מאוד מרוצה
                    </FormDescription>
                    <FormControl>
                      <div className="space-y-3">
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>לא מרוצה</span>
                          <span className="font-bold text-lg text-primary">{satisfactionValue}</span>
                          <span>מאוד מרוצה</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>הערות נוספות על האימון</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="ספרו לנו עוד על האימון - מה היה טוב, מה אפשר לשפר..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_info"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>פרטי קשר לחזרה</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="טלפון או שם לחזרה אם יש צורך"
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
