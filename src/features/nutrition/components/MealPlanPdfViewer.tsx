"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText } from "lucide-react";
import {
  MEAL_PLAN_TYPE_LABELS_HE,
  type TraineeMealPlanRow,
} from "../types";
import { formatDateHe } from "../lib/utils";
import { MEAL_PLAN_TYPES, pdfUrlFor } from "../lib/meal-plan-slots";

interface MealPlanPdfViewerProps {
  mealPlan: TraineeMealPlanRow | null;
}

export function MealPlanPdfViewer({ mealPlan }: MealPlanPdfViewerProps) {
  const hasAny =
    mealPlan && (mealPlan.workout_day_pdf_url || mealPlan.rest_day_pdf_url);

  if (!hasAny) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            תפריטי תזונה
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          המאמן שלך עדיין לא העלה תפריטי תזונה
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          תפריטי תזונה
        </CardTitle>
        <CardDescription>
          עודכן לאחרונה: {formatDateHe(mealPlan!.updated_at)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        {MEAL_PLAN_TYPES.map((planType) => {
          const url = pdfUrlFor(mealPlan, planType);
          const label = MEAL_PLAN_TYPE_LABELS_HE[planType];
          return (
            <div key={planType} className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {label}
              </h3>
              {url ? (
                <div className="rounded-lg overflow-hidden border">
                  <iframe
                    src={url}
                    className="w-full h-[480px] lg:h-[600px]"
                    title={label}
                  />
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed py-12 text-center text-xs text-muted-foreground">
                  טרם הועלה
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
