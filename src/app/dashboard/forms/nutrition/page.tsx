"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { nutritionSchema, type NutritionFormData } from "@/lib/validations/forms";
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
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, ArrowRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function NutritionFormPage() {
  const [loading, setLoading] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(nutritionSchema),
    defaultValues: {
      full_name: "",
      age: 0,
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
          .single();

        if (data) setAlreadyCompleted(true);
      }
    };

    checkExisting();
  }, []);

  const onSubmit = async (data: NutritionFormData) => {
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("נא להתחבר מחדש");
      }

      const { error } = await (supabase.from("nutrition_forms") as unknown as { insert: (data: Record<string, unknown>) => Promise<{ error: Error | null }> }).insert({
        user_id: user.id,
        ...data,
      });

      if (error) throw error;

      toast.success("שאלון התזונה נשלח בהצלחה!");
      router.push("/dashboard");
    } catch (error: unknown) {
      console.error("Submit error:", error);
      const errorMessage = error instanceof Error ? error.message : "שגיאה בשליחת השאלון";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const previousCounseling = form.watch("previous_counseling");
  const hasAllergies = form.watch("allergies");
  const hasConditions = form.watch("chronic_conditions");
  const medications = form.watch("medications");

  if (alreadyCompleted) {
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
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שם מלא *</FormLabel>
                      <FormControl>
                        <Input placeholder="הזינו את שמכם המלא" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>גיל *</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="גיל" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                </div>

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
                        <FormLabel>גובה (מטר)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="1.75" {...field} />
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
