"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RetentionTable } from "./RetentionTable";
import { ChurnedCustomersTab } from "./ChurnedCustomersTab";
import {
  getRetentionReport,
  getRetentionNotes,
  upsertRetentionNote,
} from "@/lib/actions/admin-retention";
import { getAttendanceMonthKeys } from "@/lib/arbox/retention";
import type { RetentionReportData } from "@/lib/arbox/retention";
import type {
  RetentionReportMonth,
  RetentionNote,
} from "@/lib/actions/admin-retention";
import type { ChurnedCustomer } from "@/lib/actions/admin-churned-customers";
import type { NoteColor } from "@/lib/validations/churned-customers";
import { HEBREW_MONTHS } from "@/lib/constants/hebrew-months";
import { toast } from "sonner";

function formatReportMonth(reportMonth: string): string {
  const [year, monthStr] = reportMonth.split("-");
  const monthIndex = parseInt(monthStr, 10) - 1;
  return `${HEBREW_MONTHS[monthIndex]} ${year}`;
}

interface RetentionPageClientProps {
  months: readonly RetentionReportMonth[];
  initialMonth: string | null;
  initialData: RetentionReportData | null;
  initialNotes: ReadonlyMap<string, RetentionNote>;
  initialChurned: readonly ChurnedCustomer[];
  traineePositions: Readonly<Record<string, string | null>>;
}

export function RetentionPageClient({
  months,
  initialMonth,
  initialData,
  initialNotes,
  initialChurned,
  traineePositions,
}: RetentionPageClientProps) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth ?? "");
  const [data, setData] = useState<RetentionReportData | null>(initialData);
  const [notes, setNotes] =
    useState<ReadonlyMap<string, RetentionNote>>(initialNotes);
  const [isPending, startTransition] = useTransition();

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    if (month === initialMonth) {
      setData(initialData);
      setNotes(initialNotes);
      return;
    }
    startTransition(async () => {
      try {
        const [result, notesResult] = await Promise.all([
          getRetentionReport(month),
          getRetentionNotes(month),
        ]);
        setData(result);
        setNotes(notesResult);
      } catch (err) {
        console.error("[Retention] Failed to load report:", err);
        setData(null);
        setNotes(new Map());
      }
    });
  };

  const handleSaveNote = useCallback(
    async (
      traineePhone: string,
      traineeName: string,
      note: string,
      noteColor: NoteColor,
    ) => {
      const { error } = await upsertRetentionNote(
        selectedMonth,
        traineePhone,
        traineeName,
        note,
        noteColor,
      );
      if (error) {
        toast.error(error);
        return;
      }
      // Optimistic update
      setNotes((prev) => {
        const next = new Map(prev);
        if (!note.trim() && noteColor === "none") {
          next.delete(traineePhone);
        } else {
          next.set(traineePhone, {
            note: note.trim(),
            note_color: noteColor,
            author_id: "",
            updated_at: new Date().toISOString(),
          });
        }
        return next;
      });
    },
    [selectedMonth],
  );

  const monthKeys = useMemo(
    () => (selectedMonth ? getAttendanceMonthKeys(selectedMonth) : []),
    [selectedMonth],
  );

  const hasMonths = months.length > 0;

  return (
    <div className="space-y-6">
      {hasMonths && (
        <Select value={selectedMonth} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="בחר חודש" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.report_month} value={m.report_month}>
                {formatReportMonth(m.report_month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Tabs defaultValue={hasMonths ? "monthly" : "churned"} dir="rtl">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="monthly" disabled={!hasMonths}>
            מנוי חודשי{data ? ` (${data.monthly.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="pro" disabled={!hasMonths}>
            מנוי PRO{data ? ` (${data.pro.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="training_card" disabled={!hasMonths}>
            כרטיסת אימונים{data ? ` (${data.training_card.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="churned">לקוחות שעזבו</TabsTrigger>
        </TabsList>

        {isPending ? (
          <p className="text-center text-muted-foreground py-8">טוען...</p>
        ) : (
          <>
            {hasMonths && data && (
              <>
                <TabsContent value="monthly" className="mt-4">
                  <RetentionTable
                    entries={data.monthly}
                    monthKeys={monthKeys}
                    notes={notes}
                    onSaveNote={handleSaveNote}
                    traineePositions={traineePositions}
                  />
                </TabsContent>
                <TabsContent value="pro" className="mt-4">
                  <RetentionTable
                    entries={data.pro}
                    monthKeys={monthKeys}
                    notes={notes}
                    onSaveNote={handleSaveNote}
                    traineePositions={traineePositions}
                  />
                </TabsContent>
                <TabsContent value="training_card" className="mt-4">
                  <RetentionTable
                    entries={data.training_card}
                    monthKeys={monthKeys}
                    notes={notes}
                    onSaveNote={handleSaveNote}
                    traineePositions={traineePositions}
                  />
                </TabsContent>
              </>
            )}
            <TabsContent value="churned" className="mt-4">
              <ChurnedCustomersTab initialRows={initialChurned} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
