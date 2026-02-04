"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import type { NutritionRecommendationRow } from "../types";
import { formatDateHe } from "../lib/utils";

interface NutritionRecommendationsProps {
  recommendation: NutritionRecommendationRow | null;
}

export function NutritionRecommendations({
  recommendation,
}: NutritionRecommendationsProps) {
  if (!recommendation) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            המלצות תזונה אישיות
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          המאמן שלך עדיין לא הוסיף המלצות תזונה
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          המלצות תזונה אישיות
        </CardTitle>
        <CardDescription>
          עודכן לאחרונה: {formatDateHe(recommendation.updated_at)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {recommendation.recommendation_text}
        </p>
      </CardContent>
    </Card>
  );
}
