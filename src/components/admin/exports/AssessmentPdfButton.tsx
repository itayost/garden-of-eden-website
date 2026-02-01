"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PlayerAssessment } from "@/types/assessment";

interface AssessmentPdfButtonProps {
  playerName: string;
  assessments: PlayerAssessment[];
}

export function AssessmentPdfButton({
  playerName,
  assessments,
}: AssessmentPdfButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (assessments.length === 0) {
      toast.error("אין מבדקים לייצוא");
      return;
    }

    setLoading(true);
    try {
      // Dynamic import to avoid SSR issues
      const [{ pdf }, { AssessmentPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/exports/pdf-assessment-template"),
      ]);

      const generatedAt = new Date().toLocaleDateString("he-IL");
      const blob = await pdf(
        <AssessmentPdfDocument
          playerName={playerName}
          assessments={assessments}
          generatedAt={generatedAt}
        />
      ).toBlob();

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `דוח-מבדקים-${playerName}-${new Date().toISOString().split("T")[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success("הדוח יוצא בהצלחה");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("שגיאה ביצירת הדוח");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      variant="outline"
      size="sm"
      disabled={assessments.length === 0 || loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
      ) : (
        <FileText className="h-4 w-4 ml-2" />
      )}
      {loading ? "מייצא..." : "ייצוא PDF"}
    </Button>
  );
}
