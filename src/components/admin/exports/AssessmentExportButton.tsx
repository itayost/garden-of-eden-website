"use client";

import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  ASSESSMENT_LABELS_HE,
  COORDINATION_OPTIONS,
  BODY_STRUCTURE_OPTIONS,
} from "@/types/assessment";
import type { PlayerAssessment } from "@/types/assessment";

interface AssessmentExportButtonProps {
  playerName: string;
  assessments: PlayerAssessment[];
}

export function AssessmentExportButton({
  playerName,
  assessments,
}: AssessmentExportButtonProps) {
  const handleExport = () => {
    if (assessments.length === 0) {
      toast.error("אין מבדקים לייצוא");
      return;
    }

    // Helper for categorical values
    const getCategoricalLabel = (key: string, value: string | null): string => {
      if (!value) return "";
      switch (key) {
        case "coordination":
          return COORDINATION_OPTIONS.find((o) => o.value === value)?.label || value;
        case "body_structure":
          return BODY_STRUCTURE_OPTIONS.find((o) => o.value === value)?.label || value;
        default:
          return value;
      }
    };

    // Raw measurements only (per CONTEXT.md - no rankings)
    const csvData = assessments.map((a) => ({
      "שם שחקן": playerName,
      "תאריך מבדק": formatDateHebrew(a.assessment_date),
      [ASSESSMENT_LABELS_HE.sprint_5m]: a.sprint_5m ?? "",
      [ASSESSMENT_LABELS_HE.sprint_10m]: a.sprint_10m ?? "",
      [ASSESSMENT_LABELS_HE.sprint_20m]: a.sprint_20m ?? "",
      [ASSESSMENT_LABELS_HE.jump_2leg_distance]: a.jump_2leg_distance ?? "",
      [ASSESSMENT_LABELS_HE.jump_2leg_height]: a.jump_2leg_height ?? "",
      [ASSESSMENT_LABELS_HE.jump_right_leg]: a.jump_right_leg ?? "",
      [ASSESSMENT_LABELS_HE.jump_left_leg]: a.jump_left_leg ?? "",
      [ASSESSMENT_LABELS_HE.blaze_spot_time]: a.blaze_spot_time ?? "",
      [ASSESSMENT_LABELS_HE.flexibility_ankle]: a.flexibility_ankle ?? "",
      [ASSESSMENT_LABELS_HE.flexibility_knee]: a.flexibility_knee ?? "",
      [ASSESSMENT_LABELS_HE.flexibility_hip]: a.flexibility_hip ?? "",
      [ASSESSMENT_LABELS_HE.kick_power_kaiser]: a.kick_power_kaiser ?? "",
      [ASSESSMENT_LABELS_HE.coordination]: getCategoricalLabel("coordination", a.coordination),
      [ASSESSMENT_LABELS_HE.body_structure]: getCategoricalLabel("body_structure", a.body_structure),
      "הערות": a.notes ?? "",
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `מבדקים-${playerName}-${formatDateForFilename(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast.success(`יוצאו ${assessments.length} מבדקים`);
  };

  return (
    <Button onClick={handleExport} variant="outline" size="sm" disabled={assessments.length === 0}>
      <Download className="h-4 w-4 ml-2" />
      ייצוא CSV
    </Button>
  );
}

function formatDateHebrew(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0];
}
