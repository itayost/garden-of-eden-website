"use client";

import { Fragment, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableToolbar } from "@/components/admin/TableToolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Trash2,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  markShiftReviewedAction,
  deleteShiftAction,
} from "@/lib/actions/trainer-shifts";
import type { TrainerShift } from "@/types/database";

interface TrainerShiftsViewProps {
  shifts: TrainerShift[];
  month: number;
  year: number;
  isAdmin: boolean;
}

interface TrainerSummary {
  trainerId: string;
  trainerName: string;
  totalMinutes: number;
  shiftCount: number;
  flaggedCount: number;
  shifts: TrainerShift[];
}

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
];

function calcDurationMinutes(shift: TrainerShift): number {
  const start = new Date(shift.start_time);
  const end = shift.end_time ? new Date(shift.end_time) : new Date();
  return (end.getTime() - start.getTime()) / (1000 * 60);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}:${String(mins).padStart(2, "0")}`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}

function aggregateByTrainer(shifts: TrainerShift[]): TrainerSummary[] {
  const map = new Map<string, TrainerSummary>();

  for (const shift of shifts) {
    const existing = map.get(shift.trainer_id);
    const duration = calcDurationMinutes(shift);

    if (existing) {
      existing.totalMinutes += duration;
      existing.shiftCount += 1;
      if (shift.flagged_for_review) existing.flaggedCount += 1;
      existing.shifts.push(shift);
    } else {
      map.set(shift.trainer_id, {
        trainerId: shift.trainer_id,
        trainerName: shift.trainer_name,
        totalMinutes: duration,
        shiftCount: 1,
        flaggedCount: shift.flagged_for_review ? 1 : 0,
        shifts: [shift],
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.totalMinutes - a.totalMinutes
  );
}

export function TrainerShiftsView({
  shifts,
  month,
  year,
  isAdmin,
}: TrainerShiftsViewProps) {
  const router = useRouter();
  const [expandedTrainer, setExpandedTrainer] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const allSummaries = aggregateByTrainer(shifts);

  const summaries = useMemo(() => {
    if (!search) return allSummaries;
    const searchLower = search.toLowerCase();
    return allSummaries.filter((s) =>
      s.trainerName.toLowerCase().includes(searchLower)
    );
  }, [allSummaries, search]);

  const navigateMonth = (direction: -1 | 1) => {
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    router.push(`/admin/shifts?month=${newMonth}&year=${newYear}`);
  };

  const handleMarkReviewed = async (shiftId: string) => {
    setActionLoading(shiftId);
    const result = await markShiftReviewedAction(shiftId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("המשמרת סומנה כנבדקה");
      router.refresh();
    }
    setActionLoading(null);
  };

  const handleDelete = async (shiftId: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק משמרת זו?")) return;
    setActionLoading(shiftId);
    const result = await deleteShiftAction(shiftId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("המשמרת נמחקה");
      router.refresh();
    }
    setActionLoading(null);
  };

  const totalHours = summaries.reduce((sum, s) => sum + s.totalMinutes, 0);

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold">
          {HEBREW_MONTHS[month - 1]} {year}
        </h2>
        <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 rounded-xl p-3">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">סה&quot;כ שעות</p>
                <p className="text-2xl font-bold">
                  {formatDuration(totalHours)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-green-500 rounded-xl p-3">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">משמרות</p>
                <p className="text-2xl font-bold">{shifts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="bg-orange-500 rounded-xl p-3">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">לבדיקה</p>
                  <p className="text-2xl font-bold">
                    {shifts.filter((s) => s.flagged_for_review).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Search */}
      {allSummaries.length > 0 && (
        <TableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="חיפוש לפי שם מאמן..."
        />
      )}

      {/* Trainer Summary Table */}
      {summaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            אין משמרות בחודש זה
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>סיכום לפי מאמן</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">מאמן</TableHead>
                  <TableHead className="text-right">משמרות</TableHead>
                  <TableHead className="text-right">סה&quot;כ שעות</TableHead>
                  {isAdmin && (
                    <TableHead className="text-right">סטטוס</TableHead>
                  )}
                  <TableHead className="text-right w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((summary) => (
                  <Fragment key={summary.trainerId}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setExpandedTrainer(
                          expandedTrainer === summary.trainerId
                            ? null
                            : summary.trainerId
                        )
                      }
                    >
                      <TableCell className="font-medium">
                        {summary.trainerName}
                      </TableCell>
                      <TableCell>{summary.shiftCount}</TableCell>
                      <TableCell className="font-mono">
                        {formatDuration(summary.totalMinutes)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {summary.flaggedCount > 0 && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {summary.flaggedCount} לבדיקה
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {expandedTrainer === summary.trainerId ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded shift details */}
                    {expandedTrainer === summary.trainerId &&
                      summary.shifts.map((shift) => (
                        <TableRow
                          key={shift.id}
                          className="bg-muted/30"
                        >
                          <TableCell className="pr-8 text-sm text-muted-foreground">
                            {formatDate(shift.start_time)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatTime(shift.start_time)} -{" "}
                            {shift.end_time
                              ? formatTime(shift.end_time)
                              : "פעילה"}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {shift.end_time
                              ? formatDuration(calcDurationMinutes(shift))
                              : "-"}
                            {shift.auto_ended && (
                              <Badge
                                variant="outline"
                                className="mr-2 text-xs"
                              >
                                אוטומטי
                              </Badge>
                            )}
                            {shift.flagged_for_review && (
                              <Badge
                                variant="destructive"
                                className="mr-2 text-xs"
                              >
                                לבדיקה
                              </Badge>
                            )}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {shift.flagged_for_review && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkReviewed(shift.id);
                                    }}
                                    disabled={actionLoading === shift.id}
                                  >
                                    {actionLoading === shift.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <CheckCircle className="h-3 w-3" />
                                    )}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(shift.id);
                                  }}
                                  disabled={actionLoading === shift.id}
                                  className="text-destructive hover:text-destructive"
                                >
                                  {actionLoading === shift.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          )}
                          <TableCell />
                        </TableRow>
                      ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
