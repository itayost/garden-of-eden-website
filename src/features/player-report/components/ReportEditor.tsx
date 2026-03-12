"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ReportDetailsSection } from "./ReportDetailsSection";
import { ReportAssessmentsTable } from "./ReportAssessmentsTable";
import { ReportChartsSection } from "./ReportChartsSection";
import { ReportBulletList, type BulletItem } from "./ReportBulletList";
import { ReportSummarySection } from "./ReportSummarySection";
import { PlayerReportPdfButton } from "./PlayerReportPdfButton";
import { getReportData } from "../lib/actions";
import type { ReportData } from "../types";

interface ReportEditorProps {
  initialData: ReportData;
  userId: string;
  initialFromDate: string;
  initialToDate: string;
}

export function ReportEditor({
  initialData,
  userId,
  initialFromDate,
  initialToDate,
}: ReportEditorProps) {
  const [data, setData] = useState(initialData);
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [isPending, startTransition] = useTransition();

  const [strengths, setStrengths] = useState<readonly BulletItem[]>(
    initialData.strengths.map((s) => ({ id: s.id, text: s.text })),
  );
  const [weaknesses, setWeaknesses] = useState<readonly BulletItem[]>(
    initialData.weaknesses.map((w) => ({ id: w.id, text: w.text })),
  );
  const [socialSkills, setSocialSkills] = useState<readonly BulletItem[]>(
    initialData.socialSkills.map((s) => ({ id: s.id, text: s.text })),
  );
  const [summary, setSummary] = useState(
    initialData.latestSummary?.summary ?? "",
  );

  const handleDateRangeChange = () => {
    startTransition(async () => {
      const { data: newData, error } = await getReportData(userId, fromDate, toDate);
      if (error) {
        toast.error(error);
        return;
      }
      if (newData) {
        setData(newData);
        setStrengths(newData.strengths.map((s) => ({ id: s.id, text: s.text })));
        setWeaknesses(newData.weaknesses.map((w) => ({ id: w.id, text: w.text })));
        setSocialSkills(newData.socialSkills.map((s) => ({ id: s.id, text: s.text })));
        setSummary(newData.latestSummary?.summary ?? "");
      }
    });
  };

  return (
    <div className="space-y-6" data-testid="report-editor">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold" data-testid="report-title">
          סיכום פעילות שחקן - {data.profile.full_name}
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="fromDate">מ-</Label>
            <Input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-auto"
            />
            <Label htmlFor="toDate">עד</Label>
            <Input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-auto"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleDateRangeChange}
              disabled={isPending}
              data-testid="update-date-range"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "עדכן"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <PlayerReportPdfButton
          data={data}
          strengths={strengths}
          weaknesses={weaknesses}
          socialSkills={socialSkills}
          summary={summary}
        />
      </div>

      <ReportDetailsSection profile={data.profile} attendance={data.attendance} />
      <ReportAssessmentsTable assessments={data.assessments} />
      <ReportChartsSection stats={data.stats} assessments={data.assessments} />

      <ReportBulletList
        title="נקודות חוזקה / פרמטרים ששופרו"
        items={strengths}
        onChange={setStrengths}
        headerClassName="text-green-600"
        testIdPrefix="strengths"
      />
      <ReportBulletList
        title="מיקוד לשיפור בהמשך התהליך"
        items={weaknesses}
        onChange={setWeaknesses}
        headerClassName="text-amber-600"
        testIdPrefix="weaknesses"
      />
      <ReportBulletList
        title="כישורים חברתיים"
        items={socialSkills}
        onChange={setSocialSkills}
        headerClassName="text-indigo-600"
        testIdPrefix="social-skills"
      />

      {/* key forces remount when data refreshes (CLAUDE.md gotcha: useState(prop)) */}
      <ReportSummarySection
        key={data.latestSummary?.id ?? "no-summary"}
        userId={userId}
        initialSummary={data.latestSummary?.summary ?? ""}
        onSummaryChange={setSummary}
      />
    </div>
  );
}
