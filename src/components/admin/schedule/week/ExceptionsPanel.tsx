"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { deleteExceptionAction } from "@/lib/actions/weekly-schedule";
import { hebrewWeekday } from "@/lib/utils/date";
import { shortDate } from "@/lib/utils/iso-date";
import {
  EXCEPTION_KIND_LABELS,
  type WeeklyException,
} from "@/types/weekly-schedule";
import { ExceptionFormDialog } from "./ExceptionFormDialog";

interface ExceptionsPanelProps {
  exceptions: WeeklyException[];
  trainers: TrainerOption[];
  canEdit: boolean;
  /** Window the list covers, for the empty-state copy. */
  fromDate: string;
  toDate: string;
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

      <ExceptionFormDialog
        key={formInstance}
        open={formOpen}
        onOpenChange={setFormOpen}
        trainers={trainers}
        canEdit={canEdit}
      />
    </>
  );
}
