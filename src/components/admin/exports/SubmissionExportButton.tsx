"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { PreWorkoutForm, PostWorkoutForm, NutritionForm } from "@/types/database";

/** Post workout form with trainer relation included */
type PostWorkoutWithTrainer = PostWorkoutForm & { trainers: { name: string } | null };

/** Base type that all submissions share */
type AnySubmission = { submitted_at: string; [key: string]: unknown };

interface SubmissionExportButtonProps {
  formType: "pre_workout" | "post_workout" | "nutrition";
  submissions: AnySubmission[];
}

/**
 * Export button with date filtering for form submissions
 *
 * Features:
 * - Date range filter with native HTML date inputs
 * - CSV export with UTF-8 BOM for Hebrew Excel support
 * - Hebrew column headers per form type
 */
export function SubmissionExportButton({
  formType,
  submissions,
}: SubmissionExportButtonProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleExport = () => {
    // Filter by date range if provided
    let filtered = submissions;

    if (startDate) {
      filtered = filtered.filter((s) => s.submitted_at >= startDate);
    }
    if (endDate) {
      // Include entire end day
      filtered = filtered.filter((s) => s.submitted_at <= endDate + "T23:59:59");
    }

    if (filtered.length === 0) {
      toast.error("אין נתונים לייצוא בטווח התאריכים שנבחר");
      return;
    }

    // Transform to Hebrew columns based on form type
    const csvData = transformToCSV(formType, filtered);

    // Export with BOM for Hebrew support in Excel
    const csv = Papa.unparse(csvData);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });

    // Create download link
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${formTypeToHebrew(formType)}-${formatDateForFilename(new Date())}.csv`;
    link.click();

    // Cleanup
    URL.revokeObjectURL(link.href);

    toast.success(`יוצאו ${filtered.length} שאלונים`);
  };

  return (
    <div className="flex items-end gap-4 flex-wrap">
      <div>
        <Label htmlFor={`start-date-${formType}`}>מתאריך</Label>
        <Input
          id={`start-date-${formType}`}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-40"
        />
      </div>
      <div>
        <Label htmlFor={`end-date-${formType}`}>עד תאריך</Label>
        <Input
          id={`end-date-${formType}`}
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-40"
        />
      </div>
      <Button onClick={handleExport} variant="outline">
        <Download className="h-4 w-4 ml-2" />
        ייצוא ל-CSV
      </Button>
    </div>
  );
}

/**
 * Transform submissions to CSV data with Hebrew column names
 */
function transformToCSV(
  formType: "pre_workout" | "post_workout" | "nutrition",
  submissions: AnySubmission[]
): Record<string, string | number>[] {
  switch (formType) {
    case "pre_workout":
      return (submissions as PreWorkoutForm[]).map((s) => ({
        "שם מלא": s.full_name,
        "גיל": s.age ?? "",
        "שעות שינה": s.sleep_hours ?? "",
        "תזונה": translateNutritionStatus(s.nutrition_status),
        "פציעה אחרונה": s.recent_injury ?? "",
        "אימון קבוצתי": s.group_training ?? "",
        "צבע שתן": s.urine_color ?? "",
        "משחק אחרון": s.last_game ?? "",
        "תחומי שיפור": s.improvements_desired ?? "",
        "משחק הבא": s.next_match ?? "",
        "תאריך הגשה": formatDateHebrew(s.submitted_at),
      }));

    case "post_workout":
      return (submissions as PostWorkoutWithTrainer[]).map((s) => ({
        "שם מלא": s.full_name,
        "מאמן": s.trainers?.name ?? "",
        "קושי (1-10)": s.difficulty_level,
        "שביעות רצון (1-10)": s.satisfaction_level,
        "הערות": s.comments ?? "",
        "תאריך אימון": formatDateHebrew(s.training_date),
        "תאריך הגשה": formatDateHebrew(s.submitted_at),
      }));

    case "nutrition":
      return (submissions as NutritionForm[]).map((s) => ({
        "שם מלא": s.full_name,
        "גיל": s.age,
        "משקל": s.weight ?? "",
        "גובה": s.height ?? "",
        "אלרגיות": s.allergies ? "יש" : "אין",
        "פירוט אלרגיות": s.allergies_details ?? "",
        "מחלות כרוניות": s.chronic_conditions ? "יש" : "אין",
        "פירוט מחלות": s.conditions_details ?? "",
        "תרופות": s.medications ?? "",
        "שנות ספורט תחרותי": s.years_competitive ?? "",
        "ייעוץ תזונתי קודם": s.previous_counseling ? "כן" : "לא",
        "פרטי ייעוץ": s.counseling_details ?? "",
        "תאריך הגשה": formatDateHebrew(s.submitted_at),
      }));

    default:
      return [];
  }
}

/**
 * Translate nutrition status to Hebrew
 */
function translateNutritionStatus(status: string | null): string {
  if (!status) return "";
  switch (status) {
    case "full_energy":
      return "מלא אנרגיה";
    case "insufficient":
      return "לא מספיק";
    case "no_energy":
      return "אין אנרגיה";
    default:
      return status;
  }
}

/**
 * Convert form type to Hebrew for filename
 */
function formTypeToHebrew(type: string): string {
  switch (type) {
    case "pre_workout":
      return "שאלון-לפני-אימון";
    case "post_workout":
      return "שאלון-אחרי-אימון";
    case "nutrition":
      return "שאלון-תזונה";
    default:
      return "שאלונים";
  }
}

/**
 * Format date for display in CSV (DD/MM/YYYY)
 */
function formatDateHebrew(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format date for filename (YYYY-MM-DD)
 */
function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0];
}
