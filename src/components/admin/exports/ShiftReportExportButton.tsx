"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resolveTraineeNamesForExport } from "@/lib/actions/admin-submissions-list";
import type { TrainerShiftReport } from "@/types/database";

interface ShiftReportExportButtonProps {
  submissions: TrainerShiftReport[];
}

/**
 * Export button for shift reports (pre-filtered by parent)
 *
 * Features:
 * - CSV export with UTF-8 BOM for Hebrew Excel support
 * - Hebrew column headers
 * - Boolean fields exported as כן/לא
 * - Trainee names resolved from UUIDs on export click
 * - Per-trainee achievement breakdown
 */
export function ShiftReportExportButton({
  submissions,
}: ShiftReportExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (submissions.length === 0) {
      toast.error("אין נתונים לייצוא");
      return;
    }

    setLoading(true);
    try {
      const traineeMap = await resolveTraineeNamesForExport(submissions);

      const yesNo = (value: boolean) => (value ? "כן" : "לא");
      const resolveNames = (ids: string[] | null | undefined) => {
        if (!ids || ids.length === 0) return "";
        return ids.map((id) => traineeMap[id] || id.slice(0, 8)).join(", ");
      };

      const formatPerTrainee = (
        perTrainee: Record<string, { details?: string; categories?: string[] }> | null,
      ): string => {
        if (!perTrainee || Object.keys(perTrainee).length === 0) return "";
        return Object.entries(perTrainee)
          .map(([tid, entry]) => {
            const name = traineeMap[tid] || tid.slice(0, 8);
            const cats =
              entry.categories && entry.categories.length > 0
                ? `[${entry.categories.join(", ")}]`
                : "";
            const details = entry.details || "";
            const parts = [cats, details].filter(Boolean).join(" - ");
            return parts ? `${name}: ${parts}` : name;
          })
          .join("; ");
      };

      const csvData = submissions.map((s) => {
        type PerTraineeJsonb = Record<string, { details?: string; categories?: string[] }> | null;

        const newTraineesPerTraineeText = formatPerTrainee(s.new_trainees_per_trainee as PerTraineeJsonb);
        const disciplinePerTraineeText = formatPerTrainee(s.discipline_per_trainee as PerTraineeJsonb);
        const injuriesPerTraineeText = formatPerTrainee(s.injuries_per_trainee as PerTraineeJsonb);
        const limitationsPerTraineeText = formatPerTrainee(s.limitations_per_trainee as PerTraineeJsonb);
        const workedOnPerTraineeText = formatPerTrainee(s.worked_on_per_trainee as PerTraineeJsonb);
        const achievementsPerTraineeText = formatPerTrainee(s.achievements_per_trainee as PerTraineeJsonb);
        const mentalStatePerTraineeText = formatPerTrainee(s.mental_state_per_trainee as PerTraineeJsonb);
        const complaintsPerTraineeText = formatPerTrainee(s.complaints_per_trainee as PerTraineeJsonb);
        const insufficientAttentionPerTraineeText = formatPerTrainee(s.insufficient_attention_per_trainee as PerTraineeJsonb);
        const proCandidatesPerTraineeText = formatPerTrainee(s.pro_candidates_per_trainee as PerTraineeJsonb);
        const socialSkillsPerTraineeText = formatPerTrainee(s.social_skills_per_trainee as PerTraineeJsonb);

        return {
          "מאמן": s.trainer_name,
          "תאריך דוח": formatDateHebrew(s.report_date),
          "מתאמנים חדשים": yesNo(s.trained_new_trainees),
          "שמות - מתאמנים חדשים": resolveNames(s.new_trainees_ids),
          "פרטי מתאמנים חדשים": s.new_trainees_details ?? "",
          "מתאמנים חדשים לפי מתאמן": newTraineesPerTraineeText,
          "בעיות משמעת": yesNo(s.has_discipline_issues),
          "שמות - משמעת": resolveNames(s.discipline_trainee_ids),
          "פרטי משמעת": s.discipline_details ?? "",
          "משמעת לפי מתאמן": disciplinePerTraineeText,
          "פציעות": yesNo(s.has_injuries),
          "שמות - פציעות": resolveNames(s.injuries_trainee_ids),
          "פרטי פציעות": s.injuries_details ?? "",
          "פציעות לפי מתאמן": injuriesPerTraineeText,
          "מגבלות פיזיות": yesNo(s.has_physical_limitations),
          "שמות - מגבלות": resolveNames(s.limitations_trainee_ids),
          "פרטי מגבלות": s.limitations_details ?? "",
          "מגבלות לפי מתאמן": limitationsPerTraineeText,
          "עבודה ממוקדת": yesNo(s.has_worked_on_focus),
          "שמות - עבודה ממוקדת": resolveNames(s.worked_on_trainee_ids),
          "פרטי עבודה ממוקדת": s.worked_on_details ?? "",
          "עבודה ממוקדת לפי מתאמן": workedOnPerTraineeText,
          "הישגים": yesNo(s.has_achievements),
          "שמות - הישגים": resolveNames(s.achievements_trainee_ids),
          "פרטי הישגים": s.achievements_details ?? "",
          "פרטי הישגים לפי מתאמן": achievementsPerTraineeText,
          "מצב נפשי ירוד": yesNo(s.has_poor_mental_state),
          "שמות - מצב נפשי": resolveNames(s.mental_state_trainee_ids),
          "פרטי מצב נפשי": s.mental_state_details ?? "",
          "מצב נפשי לפי מתאמן": mentalStatePerTraineeText,
          "תלונות": yesNo(s.has_complaints),
          "שמות - תלונות": resolveNames(s.complaints_trainee_ids),
          "פרטי תלונות": s.complaints_details ?? "",
          "תלונות לפי מתאמן": complaintsPerTraineeText,
          "תשומת לב לא מספקת": yesNo(s.has_insufficient_attention),
          "שמות - תשומת לב": resolveNames(s.insufficient_attention_trainee_ids),
          "פרטי תשומת לב": s.insufficient_attention_details ?? "",
          "תשומת לב לפי מתאמן": insufficientAttentionPerTraineeText,
          "מועמד PRO": yesNo(s.has_pro_candidates),
          "שמות - PRO": resolveNames(s.pro_candidates_trainee_ids),
          "פרטי PRO": s.pro_candidates_details ?? "",
          "PRO לפי מתאמן": proCandidatesPerTraineeText,
          "כישורים חברתיים": yesNo(s.has_social_skills),
          "שמות - כישורים חברתיים": resolveNames(s.social_skills_trainee_ids),
          "פרטי כישורים חברתיים": s.social_skills_details ?? "",
          "כישורים חברתיים לפי מתאמן": socialSkillsPerTraineeText,
          "הורה חיפש צוות": yesNo(s.has_parent_seeking_staff),
          "פרטי הורה": s.parent_seeking_details ?? "",
          "מבקרים חיצוניים": yesNo(s.has_external_visitors),
          "פרטי מבקרים": s.external_visitors_details ?? "",
          "תלונות הורים": yesNo(s.has_parent_complaints),
          "פרטי תלונות הורים": s.parent_complaints_details ?? "",
          "מתקן נקי": yesNo(s.facility_left_clean),
          "סיבת אי-ניקיון": s.facility_not_clean_reason ?? "",
          "ניקיון נעשה": yesNo(s.facility_cleaned_scheduled),
          "סיבת אי-ניקיון מתוזמן": s.facility_not_cleaned_reason ?? "",
          "תאריך הגשה": formatDateHebrew(s.submitted_at),
        };
      });

      const csv = Papa.unparse(csvData);
      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `דוחות-סוף-משמרת-${formatDateForFilename(new Date())}.csv`;
      link.click();

      URL.revokeObjectURL(link.href);

      toast.success(`יוצאו ${submissions.length} דוחות`);
    } catch {
      toast.error("שגיאה בייצוא הנתונים");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      variant="outline"
      disabled={submissions.length === 0 || loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 ml-2" />
      )}
      {loading ? "מייצא..." : `ייצוא ל-CSV (${submissions.length})`}
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
