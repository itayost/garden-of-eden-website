"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, ArrowLeft, ArrowRight } from "lucide-react";
import type { PlayerAssessment } from "@/types/assessment";
import { ASSESSMENT_LABELS_HE, ASSESSMENT_SECTIONS, ASSESSMENT_UNITS } from "@/types/assessment";
import { compareAssessments, getComparisonColor, type ComparisonResult } from "../lib/comparison-utils";
import { cn } from "@/lib/utils";

interface AssessmentComparisonProps {
  olderAssessment: PlayerAssessment;
  newerAssessment: PlayerAssessment;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatValue(value: number | string | null, fieldName: string): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  const unit = ASSESSMENT_UNITS[fieldName] || "";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

interface DeltaIndicatorProps {
  isImprovement: boolean | null;
  formatted: string;
}

function DeltaIndicator({ isImprovement, formatted }: DeltaIndicatorProps) {
  if (!formatted || formatted === "ללא שינוי") {
    return (
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        <Minus className="h-3 w-3" />
        {formatted || "-"}
      </span>
    );
  }

  const color = getComparisonColor(isImprovement);
  const colorClass = color === "green"
    ? "text-green-600 dark:text-green-400"
    : color === "red"
    ? "text-red-600 dark:text-red-400"
    : "text-muted-foreground";

  // Handle null case (no change) - use Minus icon, otherwise use trending icons
  const Icon = isImprovement === null ? Minus : (isImprovement ? TrendingUp : TrendingDown);

  return (
    <span className={cn("flex items-center gap-1 text-sm font-medium", colorClass)}>
      <Icon className="h-3 w-3" />
      {formatted}
    </span>
  );
}

interface ComparisonRowProps {
  fieldName: string;
  oldValue: number | string | null;
  newValue: number | string | null;
  delta: { delta: number | null; isImprovement: boolean | null; formatted: string } | undefined;
}

function ComparisonRow({ fieldName, oldValue, newValue, delta }: ComparisonRowProps) {
  const label = ASSESSMENT_LABELS_HE[fieldName] || fieldName;

  return (
    <div className="grid grid-cols-4 gap-4 py-3 border-b border-border/50 last:border-0">
      <div className="font-medium text-sm">{label}</div>
      <div className="text-center text-sm text-muted-foreground">
        {formatValue(oldValue, fieldName)}
      </div>
      <div className="text-center text-sm">
        {formatValue(newValue, fieldName)}
      </div>
      <div className="text-center">
        {delta ? (
          <DeltaIndicator isImprovement={delta.isImprovement} formatted={delta.formatted} />
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </div>
    </div>
  );
}

export function AssessmentComparison({ olderAssessment, newerAssessment }: AssessmentComparisonProps) {
  const comparison = compareAssessments(olderAssessment, newerAssessment);

  // Filter sections to only numeric and categorical types
  const comparableSections = ASSESSMENT_SECTIONS.filter(
    (section) => section.type === "number" || section.type === "select"
  );

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            השוואת מבדקים
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Date comparison */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">מבדק קודם</p>
              <p className="font-medium">{formatDate(olderAssessment.assessment_date)}</p>
            </div>
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">מבדק חדש</p>
              <p className="font-medium">{formatDate(newerAssessment.assessment_date)}</p>
            </div>
          </div>

          {/* Summary badges */}
          <div className="flex justify-center gap-4 mb-4">
            <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
              <TrendingUp className="h-3 w-3 ml-1" />
              {comparison.summary.improvements} שיפורים
            </Badge>
            <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
              <TrendingDown className="h-3 w-3 ml-1" />
              {comparison.summary.regressions} נסיגות
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              <Minus className="h-3 w-3 ml-1" />
              {comparison.summary.unchanged} ללא שינוי
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Comparison */}
      {comparableSections.map((section) => (
        <Card key={section.key}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Header row */}
            <div className="grid grid-cols-4 gap-4 pb-2 border-b-2 border-border">
              <div className="font-medium text-sm text-muted-foreground">מדד</div>
              <div className="text-center font-medium text-sm text-muted-foreground">
                קודם
              </div>
              <div className="text-center font-medium text-sm text-muted-foreground">
                חדש
              </div>
              <div className="text-center font-medium text-sm text-muted-foreground">
                שינוי
              </div>
            </div>

            {/* Data rows */}
            {section.fields.map((fieldName) => {
              const oldVal = olderAssessment[fieldName as keyof PlayerAssessment];
              const newVal = newerAssessment[fieldName as keyof PlayerAssessment];
              const delta = comparison.deltas[fieldName];

              return (
                <ComparisonRow
                  key={fieldName}
                  fieldName={fieldName}
                  oldValue={oldVal as number | string | null}
                  newValue={newVal as number | string | null}
                  delta={delta}
                />
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
