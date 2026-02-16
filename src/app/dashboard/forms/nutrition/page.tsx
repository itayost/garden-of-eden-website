"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { nutritionSchema, type NutritionFormData, type NutritionFormInput, convertFormNumbers } from "@/lib/validations/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { useFormDraft } from "@/features/form-drafts";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { FormBackButton, FormSubmitButton } from "@/components/forms";

const defaultValues: NutritionFormInput = {
  years_competitive: "",
  previous_counseling: false,
  counseling_details: "",
  weight: "",
  height: "",
  allergies: false,
  allergies_details: "",
  chronic_conditions: false,
  conditions_details: "",
  medications: "no",
  medications_list: "",
  additional_comments: "",
};

// Numeric fields that need conversion from string to number
const NUMERIC_FIELDS = [
  "weight", "height", "bloating_frequency", "stomach_pain",
  "bowel_frequency", "illness_interruptions", "max_days_missed",
  "fatigue_level", "concentration", "energy_level",
  "muscle_soreness", "physical_exhaustion", "preparedness", "overall_energy"
];

export default function NutritionFormPage() {
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  const form = useForm<NutritionFormInput>({
    resolver: zodResolver(nutritionSchema),
    defaultValues,
  });

  // Enable draft saving with auto-restore
  const draft = useFormDraft(form, { formId: "nutrition" }, defaultValues);

  // Form submission with shared hook
  const { loading, onSubmit } = useFormSubmission<NutritionFormData>({
    tableName: "nutrition_forms",
    successMessage: "שאלון התזונה נשלח בהצלחה!",
    redirectPath: "/dashboard",
    onSuccess: () => draft.clearDraft(),
    transformData: (data, userId) => {
      const convertedData = convertFormNumbers(data, NUMERIC_FIELDS);
      return {
        user_id: userId,
        ...convertedData,
      };
    },
  });

  useEffect(() => {
    const checkExisting = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("nutrition_forms")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data) setAlreadyCompleted(true);
      }
    };

    checkExisting();
  }, []);

  // eslint-disable-next-line react-hooks/incompatible-library
  const previousCounseling = form.watch("previous_counseling");
  const hasAllergies = form.watch("allergies");
  const hasConditions = form.watch("chronic_conditions");
  const medications = form.watch("medications");

  if (alreadyCompleted) {
    return (
      <div className="max-w-2xl mx-auto">
        <FormBackButton />

        <Card className="text-center py-12">
          <CardContent>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">השאלון כבר הושלם</h2>
            <p className="text-muted-foreground mb-6">
              כבר מילאת את שאלון התזונה. אין צורך למלא אותו שוב.
            </p>
            <Button asChild>
              <Link href="/dashboard">חזרה לדף הבית</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <FormBackButton />

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">שאלון תזונה</CardTitle>
          <CardDescription>
            שאלון מקיף על הרגלי התזונה והבריאות שלך - יש למלא פעם אחת בלבד
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Personal Info Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">פרטים אישיים</h3>

                <FormField
                  control={form.control}
                  name="years_competitive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שנות ספורט תחרותי</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="first_year">שנה ראשונה</SelectItem>
                          <SelectItem value="up_to_3">עד 3 שנים</SelectItem>
                          <SelectItem value="up_to_6">עד 6 שנים</SelectItem>
                          <SelectItem value="7_plus">7+ שנים</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>משקל (ק״ג)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" placeholder="70" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>גובה (ס״מ)</FormLabel>
                        <FormControl>
                          <Input type="number" step="1" placeholder="175" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Medical History Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">היסטוריה רפואית</h3>

                <FormField
                  control={form.control}
                  name="previous_counseling"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>האם קיבלת ייעוץ תזונתי בעבר?</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "true")}
                        defaultValue={field.value ? "true" : "false"}
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

                {previousCounseling && (
                  <FormField
                    control={form.control}
                    name="counseling_details"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>פרטים על הייעוץ</FormLabel>
                        <FormControl>
                          <Textarea placeholder="ספר על הייעוץ התזונתי שקיבלת" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="allergies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>האם יש אלרגיות או רגישויות למזון?</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "true")}
                        defaultValue={field.value ? "true" : "false"}
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

                {hasAllergies && (
                  <FormField
                    control={form.control}
                    name="allergies_details"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>פרט את האלרגיות</FormLabel>
                        <FormControl>
                          <Textarea placeholder="לאילו מזונות יש לך אלרגיה/רגישות?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="chronic_conditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>האם יש מצבים רפואיים כרוניים?</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "true")}
                        defaultValue={field.value ? "true" : "false"}
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

                {hasConditions && (
                  <FormField
                    control={form.control}
                    name="conditions_details"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>פרט את המצבים הרפואיים</FormLabel>
                        <FormControl>
                          <Textarea placeholder="אילו מצבים רפואיים כרוניים יש לך?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="medications"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>האם אתה נוטל תרופות או תוספי תזונה באופן קבוע?</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="no">לא</SelectItem>
                          <SelectItem value="yes">כן</SelectItem>
                          <SelectItem value="occasionally">מדי פעם</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(medications === "yes" || medications === "occasionally") && (
                  <FormField
                    control={form.control}
                    name="medications_list"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>פרט את התרופות/תוספים</FormLabel>
                        <FormControl>
                          <Textarea placeholder="אילו תרופות או תוספי תזונה אתה נוטל?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <Separator />

              {/* Additional Comments */}
              <FormField
                control={form.control}
                name="additional_comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>הערות נוספות</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="יש משהו נוסף שחשוב לנו לדעת?"
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
