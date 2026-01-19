"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { preWorkoutSchema, type PreWorkoutFormData, type PreWorkoutFormInput } from "@/lib/validations/forms";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useFormDraft } from "@/features/form-drafts";

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
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const form = useForm<PreWorkoutFormInput>({
    resolver: zodResolver(preWorkoutSchema),
    defaultValues,
  });

  // Enable draft saving with auto-restore
  const draft = useFormDraft(form, { formId: "pre-workout" }, defaultValues);

  // Calculate age from birthdate
  const calculateAge = (birthdate: string | null): number | null => {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const onSubmit = async (data: PreWorkoutFormData) => {
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("נא להתחבר מחדש");
      }

      // Get user's profile name and birthdate
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, birthdate")
        .eq("id", user.id)
        .single() as { data: { full_name: string | null; birthdate: string | null } | null };

      const { error } = await (supabase.from("pre_workout_forms") as unknown as { insert: (data: Record<string, unknown>) => Promise<{ error: Error | null }> }).insert({
        user_id: user.id,
        full_name: profile?.full_name || "לא צוין",
        age: calculateAge(profile?.birthdate ?? null),
        ...data,
      });

      if (error) throw error;

      // Clear draft after successful submission
      draft.clearDraft();

      toast.success("השאלון נשלח בהצלחה!");
      router.push("/dashboard");
    } catch (error: unknown) {
      console.error("Submit error:", error);
      const errorMessage = error instanceof Error ? error.message : "שגיאה בשליחת השאלון";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/forms"
          className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה לשאלונים
        </Link>
      </div>

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

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    שולח...
                  </>
                ) : (
                  <>
                    <Send className="ml-2 h-5 w-5" />
                    שליחת השאלון
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
