"use client";

import { useState, useActionState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb } from "lucide-react";
import type { NutritionRecommendationRow } from "@/features/nutrition/types";
import { upsertRecommendation } from "@/features/nutrition";

interface RecommendationFormProps {
  userId: string;
  existingRecommendation: NutritionRecommendationRow | null;
}

export function RecommendationForm({
  userId,
  existingRecommendation,
}: RecommendationFormProps) {
  const [text, setText] = useState(
    existingRecommendation?.recommendation_text || ""
  );

  type FormState = { success: boolean; error: string | undefined };

  const [, formAction, isPending] = useActionState(
    async (prevState: FormState, /* formData */ _: FormData) => {
      if (text.trim().length < 10) {
        toast.error("ההמלצה חייבת להכיל לפחות 10 תווים");
        return prevState;
      }

      const result = await upsertRecommendation(userId, text);

      if (result.success) {
        toast.success("ההמלצות נשמרו בהצלחה");
      } else {
        toast.error(result.error || "שגיאה בשמירת ההמלצות");
      }

      return { success: result.success, error: result.error };
    },
    { success: false, error: undefined }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          המלצות תזונה אישיות
        </CardTitle>
        <CardDescription>
          כתבו המלצות תזונה מותאמות אישית לחניך
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="הזן המלצות תזונה אישיות לחניך..."
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "שומר..." : "שמור המלצות"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
