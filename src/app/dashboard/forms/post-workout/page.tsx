"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { postWorkoutSchema, type PostWorkoutFormData } from "@/lib/validations/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { Loader2, Send, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Trainer } from "@/types/database";

export default function PostWorkoutFormPage() {
  const [loading, setLoading] = useState(false);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(postWorkoutSchema),
    defaultValues: {
      full_name: "",
      training_date: new Date().toISOString().split("T")[0],
      trainer_id: "",
      difficulty_level: 5,
      satisfaction_level: 5,
      comments: "",
      contact_info: "",
    },
  });

  useEffect(() => {
    const fetchTrainers = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("trainers")
        .select("*")
        .eq("active", true)
        .order("name") as unknown as { data: Trainer[] | null };

      if (data) setTrainers(data);
    };

    fetchTrainers();
  }, []);

  const onSubmit = async (data: PostWorkoutFormData) => {
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("נא להתחבר מחדש");
      }

      const { error } = await (supabase.from("post_workout_forms") as unknown as { insert: (data: Record<string, unknown>) => Promise<{ error: Error | null }> }).insert({
        user_id: user.id,
        ...data,
        trainer_id: data.trainer_id || null,
      });

      if (error) throw error;

      toast.success("השאלון נשלח בהצלחה! תודה על המשוב");
      router.push("/dashboard");
    } catch (error: unknown) {
      console.error("Submit error:", error);
      const errorMessage = error instanceof Error ? error.message : "שגיאה בשליחת השאלון";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const difficultyValue = form.watch("difficulty_level");
  const satisfactionValue = form.watch("satisfaction_level");

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
