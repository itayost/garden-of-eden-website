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
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RefreshCw, CalendarPlus, Loader2 } from "lucide-react";
import { RetentionTable } from "./RetentionTable";
import { ChurnedCustomersTab } from "./ChurnedCustomersTab";
import {
  getRetentionReport,
  getRetentionNotes,
  upsertRetentionNote,
  refreshRetentionReport,
} from "@/lib/actions/admin-retention";
import { createChurnedCustomer } from "@/lib/actions/admin-churned-customers";
import { getAttendanceMonthKeys } from "@/lib/arbox/retention";
import type {
  RetentionEntry,
  RetentionReportData,
} from "@/lib/arbox/retention";
import type {
  RetentionReportMonth,
  RetentionNote,
} from "@/lib/actions/admin-retention";
import type { ChurnedCustomer } from "@/lib/actions/admin-churned-customers";
import type { NoteColor } from "@/lib/validations/churned-customers";
import { HEBREW_MONTHS } from "@/lib/constants/hebrew-months";
import { buildChurnedKey } from "@/lib/utils/churned-key";
import { formatRelativeTime } from "@/lib/utils/date";
import { toast } from "sonner";

function formatReportMonth(reportMonth: string): string {
  const [year, monthStr] = reportMonth.split("-");
  const monthIndex = parseInt(monthStr, 10) - 1;
  return `${HEBREW_MONTHS[monthIndex]} ${year}`;
}

function upsertMonthInList(
  months: readonly RetentionReportMonth[],
  reportMonth: string,
  refreshedAt: string,
): readonly RetentionReportMonth[] {
  const existingIndex = months.findIndex(
    (m) => m.report_month === reportMonth,
  );
  if (existingIndex !== -1) {
    if (months[existingIndex].created_at === refreshedAt) return months;
    return months.map((m, i) =>
      i === existingIndex ? { ...m, created_at: refreshedAt } : m,
    );
  }
  const entry = { report_month: reportMonth, created_at: refreshedAt };
  const insertIndex = months.findIndex((m) => m.report_month < reportMonth);
  if (insertIndex === -1) return [...months, entry];
  return [...months.slice(0, insertIndex), entry, ...months.slice(insertIndex)];
}

interface RetentionPageClientProps {
  months: readonly RetentionReportMonth[];
  initialMonth: string;
  currentMonth: string;
  initialData: RetentionReportData | null;
  initialNotes: ReadonlyMap<string, RetentionNote>;
  initialChurned: readonly ChurnedCustomer[];
  traineePositions: Readonly<Record<string, string | null>>;
}

export function RetentionPageClient({
  months: initialMonths,
  initialMonth,
  currentMonth,
  initialData,
  initialNotes,
  initialChurned,
  traineePositions,
}: RetentionPageClientProps) {
  const [allMonths, setAllMonths] =
    useState<readonly RetentionReportMonth[]>(initialMonths);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [data, setData] = useState<RetentionReportData | null>(initialData);
  const [notes, setNotes] =
    useState<ReadonlyMap<string, RetentionNote>>(initialNotes);
  const [churned, setChurned] =
    useState<readonly ChurnedCustomer[]>(initialChurned);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();

  const movedKeys = useMemo(
    () =>
      new Set(churned.map((c) => buildChurnedKey(c.name, c.end_date))),
    [churned],
  );

  const lastRefreshedAt = useMemo(
    () =>
      allMonths.find((m) => m.report_month === selectedMonth)?.created_at ??
      null,
    [allMonths, selectedMonth],
  );

  const lastRefreshedLabel = lastRefreshedAt
    ? formatRelativeTime(lastRefreshedAt)
    : null;

  const handleMoveToChurned = useCallback(
    async (entry: RetentionEntry, note: string, noteColor: NoteColor) => {
      const result = await createChurnedCustomer({
        name: entry.name,
        endDate: entry.end_date,
        note,
        noteColor,
      });
      if (result.error || !result.data) {
        toast.error(result.error ?? "שגיאה בהעברה");
        return;
      }
      setChurned((prev) => [result.data!, ...prev]);
      toast.success("הועבר ללקוחות שעזבו");
    },
    [],
  );

  const loadMonth = useCallback((month: string) => {
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
  }, []);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    loadMonth(month);
  };

  const handleRefresh = useCallback(
    (target: string, options: { switchTo?: boolean } = {}) => {
      startRefreshTransition(async () => {
        const result = await refreshRetentionReport(target);
        if (result.error || !result.data || !result.refreshedAt) {
          toast.error(result.error ?? "שגיאה בריענון הדוח");
          return;
        }
        const refreshedAt = result.refreshedAt;
        setAllMonths((prev) => upsertMonthInList(prev, target, refreshedAt));
        if (options.switchTo && target !== selectedMonth) {
          setSelectedMonth(target);
          setData(result.data);
          try {
            const newNotes = await getRetentionNotes(target);
            setNotes(newNotes);
          } catch {
            setNotes(new Map());
          }
        } else if (target === selectedMonth) {
          setData(result.data);
        }
        toast.success("הדוח עודכן");
      });
    },
    [selectedMonth],
  );

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

  const hasData = data !== null;
  // Past months are frozen snapshots — refreshing would overwrite them with
  // live Arbox data whose end-dates have since moved forward.
  const isLocked = selectedMonth < currentMonth;
  const refreshDisabled = isRefreshing || isPending || isLocked;

  const generateCta = isLocked ? (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="text-muted-foreground">
        לא נשמר דוח עבור {formatReportMonth(selectedMonth)}. דוחות של חודשים
        שהסתיימו נעולים ולא ניתן ליצור אותם כעת.
      </p>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="text-muted-foreground">
        אין דוח עדיין עבור {formatReportMonth(selectedMonth)}.
      </p>
      <Button
        onClick={() => handleRefresh(selectedMonth)}
        disabled={refreshDisabled}
      >
        {isRefreshing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CalendarPlus className="size-4" />
        )}
        צור דוח
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedMonth} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="בחר חודש" />
          </SelectTrigger>
          <SelectContent>
            {allMonths.map((m) => (
              <SelectItem key={m.report_month} value={m.report_month}>
                {formatReportMonth(m.report_month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRefresh(selectedMonth)}
          disabled={refreshDisabled}
          title={isLocked ? "דוח של חודש שהסתיים נעול" : undefined}
        >
          {isRefreshing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          רענן
        </Button>

        <CustomMonthPicker
          disabled={isRefreshing || isPending}
          currentMonth={currentMonth}
          onSelect={(reportMonth) =>
            handleRefresh(reportMonth, { switchTo: true })
          }
        />

        {isLocked ? (
          <span className="text-xs text-muted-foreground">
            🔒 דוח חודש שהסתיים — נעול
          </span>
        ) : (
          lastRefreshedLabel && (
            <span className="text-xs text-muted-foreground">
              עודכן {lastRefreshedLabel}
            </span>
          )
        )}
      </div>

      <Tabs defaultValue="monthly" dir="rtl">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="monthly">
            מנוי חודשי{data ? ` (${data.monthly.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="pro">
            מנוי PRO{data ? ` (${data.pro.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="training_card">
            כרטיסת אימונים{data ? ` (${data.training_card.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="churned">לקוחות שעזבו</TabsTrigger>
        </TabsList>

        {isPending ? (
          <p className="text-center text-muted-foreground py-8">טוען...</p>
        ) : (
          <>
            {(["monthly", "pro", "training_card"] as const).map((category) => (
              <TabsContent key={category} value={category} className="mt-4">
                {hasData ? (
                  <RetentionTable
                    entries={data[category]}
                    monthKeys={monthKeys}
                    notes={notes}
                    onSaveNote={handleSaveNote}
                    traineePositions={traineePositions}
                    movedKeys={movedKeys}
                    onMoveToChurned={handleMoveToChurned}
                  />
                ) : (
                  generateCta
                )}
              </TabsContent>
            ))}
            <TabsContent value="churned" className="mt-4">
              <ChurnedCustomersTab rows={churned} setRows={setChurned} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

interface CustomMonthPickerProps {
  disabled: boolean;
  currentMonth: string;
  onSelect: (reportMonth: string) => void;
}

function CustomMonthPicker({
  disabled,
  currentMonth,
  onSelect,
}: CustomMonthPickerProps) {
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);

  const yearOptions = useMemo(
    () => [defaultYear - 1, defaultYear, defaultYear + 1],
    [defaultYear],
  );

  const handleSubmit = () => {
    const reportMonth = `${year}-${String(month).padStart(2, "0")}-01`;
    if (reportMonth < currentMonth) {
      toast.error("לא ניתן ליצור דוח לחודש שהסתיים");
      return;
    }
    onSelect(reportMonth);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <CalendarPlus className="size-4" />
          חודש מותאם
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="start">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">חודש</label>
          <Select
            value={String(month)}
            onValueChange={(v) => setMonth(parseInt(v, 10))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HEBREW_MONTHS.map((label, idx) => (
                <SelectItem key={idx + 1} value={String(idx + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">שנה</label>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(parseInt(v, 10))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="w-full" onClick={handleSubmit} disabled={disabled}>
          צור דוח לחודש זה
        </Button>
      </PopoverContent>
    </Popover>
  );
}
