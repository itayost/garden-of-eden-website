"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FileText } from "lucide-react";
import type { TraineeMealPlanRow } from "../types";
import { formatDateHe } from "../lib/utils";

interface MealPlanPdfViewerProps {
  mealPlan: TraineeMealPlanRow | null;
}

export function MealPlanPdfViewer({ mealPlan }: MealPlanPdfViewerProps) {
  if (!mealPlan?.pdf_url) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            תפריט תזונה
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          המאמן שלך עדיין לא העלה תפריט תזונה
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          תפריט תזונה
        </CardTitle>
        <CardDescription>
          עודכן לאחרונה: {formatDateHe(mealPlan.updated_at)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg overflow-hidden border">
          <iframe
            src={mealPlan.pdf_url}
            className="w-full h-[600px] sm:h-[800px]"
            title="תפריט תזונה"
          />
        </div>
      </CardContent>
    </Card>
  );
}
