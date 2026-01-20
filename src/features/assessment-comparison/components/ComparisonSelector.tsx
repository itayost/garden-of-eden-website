"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeftRight, GitCompare } from "lucide-react";
import type { PlayerAssessment } from "@/types/assessment";
import { AssessmentComparison } from "./AssessmentComparison";

interface ComparisonSelectorProps {
  assessments: PlayerAssessment[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ComparisonSelector({ assessments }: ComparisonSelectorProps) {
  // Sort assessments by date (newest first for selection)
  const sortedAssessments = useMemo(
    () =>
      [...assessments].sort(
        (a, b) =>
          new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime()
      ),
    [assessments]
  );

  // Default: compare last two assessments
  const [olderAssessmentId, setOlderAssessmentId] = useState<string>(
    sortedAssessments.length > 1 ? sortedAssessments[1].id : ""
  );
  const [newerAssessmentId, setNewerAssessmentId] = useState<string>(
    sortedAssessments.length > 0 ? sortedAssessments[0].id : ""
  );

  const olderAssessment = assessments.find((a) => a.id === olderAssessmentId);
  const newerAssessment = assessments.find((a) => a.id === newerAssessmentId);

  // Swap the selected assessments
  const handleSwap = () => {
    setOlderAssessmentId(newerAssessmentId);
    setNewerAssessmentId(olderAssessmentId);
  };

  if (assessments.length < 2) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <GitCompare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">אין מספיק מבדקים להשוואה</h3>
          <p className="text-muted-foreground text-center">
            נדרשים לפחות שני מבדקים כדי להשוות ביניהם.
            <br />
            המבדק הבא שלך יאפשר השוואה ומעקב התקדמות.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            בחירת מבדקים להשוואה
          </CardTitle>
          <CardDescription>
            בחרו שני מבדקים כדי לראות את ההתקדמות שלכם
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Older assessment selector */}
            <div className="flex-1 w-full">
              <label className="text-sm font-medium mb-2 block">מבדק קודם</label>
              <Select value={olderAssessmentId} onValueChange={setOlderAssessmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר מבדק" />
                </SelectTrigger>
                <SelectContent>
                  {sortedAssessments
                    .filter((a) => a.id !== newerAssessmentId)
                    .map((assessment) => (
                      <SelectItem key={assessment.id} value={assessment.id}>
                        {formatDate(assessment.assessment_date)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Swap button */}
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 mt-6 sm:mt-0"
              onClick={handleSwap}
              title="החלף מבדקים"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>

            {/* Newer assessment selector */}
            <div className="flex-1 w-full">
              <label className="text-sm font-medium mb-2 block">מבדק חדש</label>
              <Select value={newerAssessmentId} onValueChange={setNewerAssessmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר מבדק" />
                </SelectTrigger>
                <SelectContent>
                  {sortedAssessments
                    .filter((a) => a.id !== olderAssessmentId)
                    .map((assessment) => (
                      <SelectItem key={assessment.id} value={assessment.id}>
                        {formatDate(assessment.assessment_date)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison View */}
      {olderAssessment && newerAssessment && (
        <AssessmentComparison
          olderAssessment={olderAssessment}
          newerAssessment={newerAssessment}
        />
      )}
    </div>
  );
}
