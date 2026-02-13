"use client";

import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
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
 */
export function ShiftReportExportButton({
  submissions,
}: ShiftReportExportButtonProps) {
  const handleExport = () => {
    if (submissions.length === 0) {
      toast.error("אין נתונים לייצוא");
      return;
    }

    const yesNo = (value: boolean) => (value ? "כן" : "לא");

    const csvData = submissions.map((s) => ({
      "מאמן": s.trainer_name,
      "תאריך דוח": formatDateHebrew(s.report_date),
      "מתאמנים חדשים": yesNo(s.trained_new_trainees),
      "פרטי מתאמנים חדשים": s.new_trainees_details ?? "",
      "בעיות משמעת": yesNo(s.has_discipline_issues),
      "פרטי משמעת": s.discipline_details ?? "",
      "פציעות": yesNo(s.has_injuries),
      "פרטי פציעות": s.injuries_details ?? "",
      "מגבלות פיזיות": yesNo(s.has_physical_limitations),
      "פרטי מגבלות": s.limitations_details ?? "",
      "הישגים": yesNo(s.has_achievements),
      "פרטי הישגים": s.achievements_details ?? "",
      "מצב נפשי ירוד": yesNo(s.has_poor_mental_state),
      "פרטי מצב נפשי": s.mental_state_details ?? "",
      "תלונות": yesNo(s.has_complaints),
      "פרטי תלונות": s.complaints_details ?? "",
      "תשומת לב לא מספקת": yesNo(s.has_insufficient_attention),
      "פרטי תשומת לב": s.insufficient_attention_details ?? "",
      "מועמד PRO": yesNo(s.has_pro_candidates),
      "פרטי PRO": s.pro_candidates_details ?? "",
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
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `דוחות-סוף-משמרת-${formatDateForFilename(new Date())}.csv`;
    link.click();

    URL.revokeObjectURL(link.href);

    toast.success(`יוצאו ${submissions.length} דוחות`);
  };

  return (
    <Button onClick={handleExport} variant="outline" disabled={submissions.length === 0}>
      <Download className="h-4 w-4 ml-2" />
      ייצוא ל-CSV ({submissions.length})
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
