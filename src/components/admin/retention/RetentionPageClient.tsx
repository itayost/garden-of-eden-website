"use client";

import { useState, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RetentionTable } from "./RetentionTable";
import { getRetentionReport } from "@/lib/actions/admin-retention";
import { getAttendanceMonthKeys } from "@/lib/arbox/retention";
import type { RetentionReportData } from "@/lib/arbox/retention";
import type { RetentionReportMonth } from "@/lib/actions/admin-retention";

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
] as const;

function formatReportMonth(reportMonth: string): string {
  const [year, monthStr] = reportMonth.split("-");
  const monthIndex = parseInt(monthStr, 10) - 1;
  return `${HEBREW_MONTHS[monthIndex]} ${year}`;
}

interface RetentionPageClientProps {
  months: readonly RetentionReportMonth[];
  initialMonth: string | null;
  initialData: RetentionReportData | null;
}

export function RetentionPageClient({
  months,
  initialMonth,
  initialData,
}: RetentionPageClientProps) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth ?? "");
  const [data, setData] = useState<RetentionReportData | null>(initialData);
  const [isPending, startTransition] = useTransition();

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    if (month === initialMonth) {
      setData(initialData);
      return;
    }
    startTransition(async () => {
      try {
        const result = await getRetentionReport(month);
        setData(result);
      } catch (err) {
        console.error("[Retention] Failed to load report:", err);
        setData(null);
      }
    });
  };

  if (months.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        אין דוחות זמינים
      </p>
    );
  }

  const monthKeys = selectedMonth
    ? getAttendanceMonthKeys(selectedMonth)
    : [];

  return (
    <div className="space-y-6">
      {/* Month selector */}
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

      {isPending ? (
        <p className="text-center text-muted-foreground py-8">טוען...</p>
      ) : data ? (
        <Tabs defaultValue="monthly" dir="rtl">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="monthly">
              מנוי חודשי ({data.monthly.length})
            </TabsTrigger>
            <TabsTrigger value="pro">
              מנוי PRO ({data.pro.length})
            </TabsTrigger>
            <TabsTrigger value="training_card">
              כרטיסת אימונים ({data.training_card.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="mt-4">
            <RetentionTable entries={data.monthly} monthKeys={monthKeys} />
          </TabsContent>

          <TabsContent value="pro" className="mt-4">
            <RetentionTable entries={data.pro} monthKeys={monthKeys} />
          </TabsContent>

          <TabsContent value="training_card" className="mt-4">
            <RetentionTable entries={data.training_card} monthKeys={monthKeys} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
