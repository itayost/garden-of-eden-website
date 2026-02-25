"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingSchema, type OnboardingData } from "@/lib/validations/profile";
import { completeOnboardingAction } from "@/lib/actions/complete-onboarding";
import { POSITIONS, POSITION_LABELS_HE } from "@/types/player-stats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface ProfileCompletionFormProps {
  userId: string;
  fullName: string;
  initialData?: {
    birthdate?: string | null;
    position?: string | null;
  };
}

export function ProfileCompletionForm({
  userId,
  fullName,
  initialData,
}: ProfileCompletionFormProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<OnboardingData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      full_name: fullName || "",
      birthdate: initialData?.birthdate || "",
      position:
        (initialData?.position as OnboardingData["position"]) || undefined,
    },
  });

  const onSubmit = async (data: OnboardingData) => {
    setLoading(true);

    try {
      const result = await completeOnboardingAction({
        full_name: data.full_name,
        birthdate: data.birthdate,
        position: data.position || null,
      });

      if (result.error) {
        toast.error(result.error);
        setLoading(false);
        return;
      }

      toast.success("!בואו נתחיל");
      window.location.assign("/dashboard");
    } catch {
      toast.error("שגיאה בשמירת הפרופיל. נסה שוב.");
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto border-[#22C55E]/20">
      {/* Welcome Section */}
      <div className="px-6 pt-8 pb-2 text-center space-y-3">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
          ⚽
        </div>
        <h1 className="text-2xl font-bold">
          {fullName ? `ברוך הבא, ${fullName}!` : "!ברוך הבא"}
        </h1>
        <p className="text-muted-foreground text-sm">
          עוד רגע ואתה מוכן להתחיל באימונים
        </p>
      </div>

      {/* Form Section */}
      <CardContent className="pt-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם מלא</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="הכנס את שמך המלא"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="birthdate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תאריך לידה</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      disabled={loading}
                      max={new Date().toISOString().split("T")[0]}
                      className="w-full max-w-full"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>משמש לחישוב קבוצת גיל</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>עמדה מועדפת</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value || undefined}
                    disabled={loading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר עמדה (לא חובה)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {POSITIONS.map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {POSITION_LABELS_HE[pos]} ({pos})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    העמדה שאתה משחק בה בדרך כלל
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  שומר...
                </>
              ) : (
                <>
                  <ArrowLeft className="ml-2 h-5 w-5" />
                  בואו נתחיל
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
