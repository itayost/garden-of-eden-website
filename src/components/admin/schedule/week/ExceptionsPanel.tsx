"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SheetDialogContent } from "@/components/ui/sheet-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import {
  createExceptionAction,
  deleteExceptionAction,
} from "@/lib/actions/weekly-schedule";
import { hebrewWeekday } from "@/lib/utils/date";
import {
  EXCEPTION_KIND_LABELS,
  type ExceptionKind,
  type WeeklyException,
} from "@/types/weekly-schedule";

interface ExceptionsPanelProps {
  exceptions: WeeklyException[];
  trainers: TrainerOption[];
  canEdit: boolean;
  /** Window the list covers, for the empty-state copy. */
  fromDate: string;
  toDate: string;
}

function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(day)}.${Number(month)}`;
}

function timeLabel(exception: WeeklyException): string | null {
  if (!exception.start_time) return null;
  const start = exception.start_time.slice(0, 5);
  if (!exception.end_time) return `${start} והלאה`;
  return `${start}–${exception.end_time.slice(0, 5)}`;
}

/**
 * Dated deviations from the standing week. They never edit the Bands, so next
 * week is unaffected — that separation is the point of the feature.
 */
export function ExceptionsPanel({
  exceptions,
  trainers,
  canEdit,
  fromDate,
  toDate,
}: ExceptionsPanelProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [formInstance, setFormInstance] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (exception: WeeklyException) => {
    setDeletingId(exception.id);
    try {
      const result = await deleteExceptionAction(exception.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("החריגה נמחקה");
      router.refresh();
    } catch {
      toast.error("שגיאה במחיקת החריגה");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-lg">חריגות</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              היעדרות או תוספת בתאריך מסוים. הלוח השבועי עצמו לא משתנה.
            </p>
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFormInstance((n) => n + 1);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              חריגה
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {exceptions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              אין חריגות בין {shortDate(fromDate)} ל-{shortDate(toDate)}.
            </p>
          ) : (
            <ul className="divide-y">
              {exceptions.map((exception) => {
                const times = timeLabel(exception);
                return (
                  <li
                    key={exception.id}
                    className="flex items-start justify-between gap-2 py-2.5"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            exception.kind === "absent" ? "outline" : "secondary"
                          }
                          className="gap-1 font-normal"
                        >
                          {exception.kind === "absent" ? (
                            <CalendarOff className="h-3 w-3" />
                          ) : (
                            <UserPlus className="h-3 w-3" />
                          )}
                          {EXCEPTION_KIND_LABELS[exception.kind]}
                        </Badge>
                        <span className="text-sm font-bold">
                          {exception.trainer_name}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {hebrewWeekday(exception.exception_date)} ·{" "}
                          {shortDate(exception.exception_date)}
                          {times ? ` · ${times}` : ""}
                        </span>
                      </div>
                      {(exception.note_he ||
                        exception.label_he ||
                        exception.location_he) && (
                        <p className="truncate text-xs text-muted-foreground">
                          {[exception.note_he, exception.label_he, exception.location_he]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>

                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={deletingId === exception.id}
                        onClick={() => handleDelete(exception)}
                        aria-label={`מחיקת החריגה של ${exception.trainer_name}`}
                      >
                        {deletingId === exception.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <ExceptionFormDialog
          key={formInstance}
          open={formOpen}
          onOpenChange={setFormOpen}
          trainers={trainers}
        />
      )}
    </>
  );
}

interface ExceptionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainers: TrainerOption[];
}

function ExceptionFormDialog({
  open,
  onOpenChange,
  trainers,
}: ExceptionFormDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [kind, setKind] = useState<ExceptionKind>("absent");
  const [exceptionDate, setExceptionDate] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");

  const isExtra = kind === "extra";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trainerId) {
      toast.error("יש לבחור מאמן");
      return;
    }

    setLoading(true);
    try {
      const result = await createExceptionAction({
        exceptionDate,
        trainerId,
        kind,
        // An absence covers the whole day, so it must not carry times even if
        // the fields were filled in before the kind was switched.
        startTime: isExtra ? startTime : "",
        endTime: isExtra ? endTime : "",
        location: isExtra ? location : "",
        label: isExtra ? label : "",
        note,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("החריגה נשמרה");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת החריגה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetDialogContent>
        <DialogHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
          <DialogTitle>חריגה חדשה</DialogTitle>
          <DialogDescription>
            החלפה נרשמת כשתי חריגות: היעדרות של האחד ותוספת של השני.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6"
        >
          <div className="space-y-2">
            <Label htmlFor="exception-kind">סוג</Label>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as ExceptionKind)}
            >
              <SelectTrigger id="exception-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absent">
                  היעדרות — המאמן לא מגיע ביום הזה
                </SelectItem>
                <SelectItem value="extra">
                  תוספת חד-פעמית — רצועה נוספת ביום הזה
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exception-date">תאריך</Label>
            <Input
              id="exception-date"
              type="date"
              value={exceptionDate}
              onChange={(event) => setExceptionDate(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exception-trainer">מאמן</Label>
            <Select value={trainerId} onValueChange={setTrainerId}>
              <SelectTrigger id="exception-trainer">
                <SelectValue placeholder="בחירת מאמן" />
              </SelectTrigger>
              <SelectContent>
                {trainers.map((trainer) => (
                  <SelectItem key={trainer.id} value={trainer.id}>
                    {trainer.full_name ?? "ללא שם"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isExtra && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="exception-start">שעת התחלה</Label>
                  <Input
                    id="exception-start"
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exception-end">שעת סיום</Label>
                  <Input
                    id="exception-end"
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exception-location">מיקום (אופציונלי)</Label>
                <Input
                  id="exception-location"
                  value={location}
                  placeholder="לדוגמה: סטודיו"
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exception-label">קבוצה (אופציונלי)</Label>
                <Input
                  id="exception-label"
                  value={label}
                  placeholder="לדוגמה: נערים א׳"
                  onChange={(event) => setLabel(event.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="exception-note">הערה (אופציונלי)</Label>
            <Input
              id="exception-note"
              value={note}
              placeholder={isExtra ? "לדוגמה: מחליף את לידור" : "לדוגמה: חופשה"}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background px-4 pt-3 pb-1 sm:-mx-6 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              שמירה
            </Button>
          </div>
        </form>
      </SheetDialogContent>
    </Dialog>
  );
}
