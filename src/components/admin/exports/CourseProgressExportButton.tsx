"use client";

import Papa from "papaparse";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TraineeCourseProgress } from "@/features/course/lib/actions/course-progress-report";

interface CourseProgressExportButtonProps {
  trainees: TraineeCourseProgress[];
  lessonTotal: number;
}

export function CourseProgressExportButton({
  trainees,
  lessonTotal,
}: CourseProgressExportButtonProps) {
  const handleExport = () => {
    if (trainees.length === 0) {
      toast.error("אין נתונים לייצוא");
      return;
    }

    const rows = trainees.map((trainee) => ({
      "שם מתאמן": trainee.fullName,
      "שיעורים שהושלמו": trainee.doneCount,
      "מתוך": lessonTotal,
      "אחוז השלמה":
        lessonTotal > 0
          ? Math.round((trainee.doneCount / lessonTotal) * 100)
          : 0,
      "צפייה אחרונה": trainee.lastActivityAt
        ? formatDateHebrew(trainee.lastActivityAt)
        : "",
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `התקדמות-קורס-${formatDateForFilename(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast.success(`יוצאו ${trainees.length} מתאמנים`);
  };

  return (
    <Button
      onClick={handleExport}
      variant="outline"
      size="sm"
      disabled={trainees.length === 0}
    >
      <Download className="h-4 w-4 me-2" />
      ייצוא CSV
    </Button>
  );
}

function formatDateHebrew(value: string): string {
  return new Date(value).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0];
}
