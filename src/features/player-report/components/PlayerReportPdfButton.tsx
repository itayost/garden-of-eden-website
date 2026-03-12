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
}

export function PlayerReportPdfButton({
  data,
  strengths,
  weaknesses,
  socialSkills,
  summary,
}: PlayerReportPdfButtonProps) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const body = {
        profile: {
          full_name: data.profile.full_name,
          birthdate: data.profile.birthdate,
          position: data.profile.position,
          club: data.profile.club,
          created_at: data.profile.created_at,
          processed_avatar_url: data.profile.processed_avatar_url,
        },
        assessments: data.assessments,
        stats: data.stats,
        attendance: data.attendance
          ? { totalSessions: data.attendance.totalSessions, weeklyAverage: data.attendance.weeklyAverage }
          : null,
        summary,
        strengths: strengths.map((s) => s.text),
        weaknesses: weaknesses.map((w) => w.text),
        socialSkills: socialSkills.map((s) => s.text),
      };

      const response = await fetch("/api/player-report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const { error } = (await response.json()) as { error: string };
        toast.error(error ?? "שגיאה ביצירת ה-PDF");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const name = data.profile.full_name ?? "report";
      const date = new Date().toISOString().split("T")[0];
      link.download = `סיכום-שחקן-${name}-${date}.pdf`;
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
