"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { toast } from "sonner";
import { PlayerReportPdfDocument } from "@/lib/exports/pdf-player-report-template";
import { captureChartAsImage } from "../lib/utils/chart-snapshot";
import type { ReportData } from "../types";
import type { BulletItem } from "./ReportBulletList";

interface PlayerReportPdfButtonProps {
  data: ReportData;
  strengths: readonly BulletItem[];
  weaknesses: readonly BulletItem[];
  socialSkills: readonly BulletItem[];
  summary: string;
  radarRef: React.RefObject<HTMLDivElement | null>;
  trendsRef: React.RefObject<HTMLDivElement | null>;
}

export function PlayerReportPdfButton({
  data,
  strengths,
  weaknesses,
  socialSkills,
  summary,
  radarRef,
  trendsRef,
}: PlayerReportPdfButtonProps) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);

    try {
      const radarImage = await captureChartAsImage(radarRef.current);
      const trendsImage = await captureChartAsImage(trendsRef.current);

      const now = new Date().toLocaleDateString("he-IL");

      const doc = (
        <PlayerReportPdfDocument
          playerName={data.profile.full_name ?? "שחקן"}
          details={{
            birthdate: data.profile.birthdate,
            position: data.profile.position,
            club: data.profile.club,
            registrationDate: data.profile.created_at,
            weeklyAttendance: data.attendance
              ? `${data.attendance.weeklyAverage.toFixed(1)} בשבוע`
              : "לא זמין",
          }}
          assessments={data.assessments}
          radarChartImage={radarImage}
          trendsChartImage={trendsImage}
          strengths={strengths.map((s) => s.text)}
          weaknesses={weaknesses.map((w) => w.text)}
          socialSkills={socialSkills.map((s) => s.text)}
          summary={summary}
          generatedAt={now}
        />
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `סיכום-שחקן-${data.profile.full_name ?? "report"}-${now}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 200);
    } catch {
      toast.error("שגיאה ביצירת ה-PDF, נסה שוב");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button onClick={handleGenerate} disabled={generating} data-testid="download-pdf">
      {generating ? (
        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4 ml-2" />
      )}
      {generating ? "מייצר PDF..." : "הורד PDF"}
    </Button>
  );
}
