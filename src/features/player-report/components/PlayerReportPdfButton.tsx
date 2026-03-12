"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  fifaCardRef: React.RefObject<HTMLDivElement | null>;
}

export function PlayerReportPdfButton({
  data,
  strengths,
  weaknesses,
  socialSkills,
  summary,
  radarRef,
  trendsRef,
  fifaCardRef,
}: PlayerReportPdfButtonProps) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);

    try {
      // Dynamic imports to avoid SSR issues with @react-pdf/renderer
      const [{ pdf }, { PlayerReportPdfDocument }, { captureChartAsImage }] =
        await Promise.all([
          import("@react-pdf/renderer"),
          import("@/lib/exports/pdf-player-report-template"),
          import("../lib/utils/chart-snapshot"),
        ]);

      const [radarImage, trendsImage, fifaCardImage] = await Promise.all([
        captureChartAsImage(radarRef.current),
        captureChartAsImage(trendsRef.current),
        captureChartAsImage(fifaCardRef.current, undefined),
      ]);

      const now = new Date().toLocaleDateString("he-IL");

      const ageStr = data.profile.birthdate
        ? String(Math.floor((Date.now() - new Date(data.profile.birthdate).getTime()) / (365.25 * 24 * 3600 * 1000)))
        : null;

      const doc = (
        <PlayerReportPdfDocument
          playerName={data.profile.full_name ?? "שחקן"}
          details={{
            age: ageStr,
            position: data.profile.position,
            club: data.profile.club,
            registrationDate: data.profile.created_at,
            weeklyAttendance: data.attendance
              ? `${data.attendance.weeklyAverage.toFixed(1)} בשבוע`
              : "לא זמין",
          }}
          stats={data.stats}
          assessments={data.assessments}
          radarChartImage={radarImage}
          trendsChartImage={trendsImage}
          fifaCardImage={fifaCardImage}
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
    } catch (err) {
      console.error("[PlayerReportPdfButton] PDF generation failed:", err);
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
