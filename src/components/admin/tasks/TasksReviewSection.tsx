"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCheck, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  acknowledgeAllTasksAction,
  acknowledgeTaskAction,
} from "@/lib/actions/admin-tasks";
import { formatDateShort } from "@/lib/utils/date";
import { formatDueDate, isAwaitingReview, isTaskOverdue } from "@/lib/utils/tasks";
import type { TrainerTask } from "@/types/tasks";
import { TaskNoteDialog } from "./TaskNoteDialog";

interface TasksReviewSectionProps {
  tasks: TrainerTask[];
  /** Today in Israel, ISO YYYY-MM-DD. */
  today: string;
}

/**
 * The admin's alert surface. Both lists are DERIVED from the task rows — there
 * is no notifications table.
 *
 * Overdue tasks leave this list on their own when closed, cancelled or
 * rescheduled. Closed tasks require an explicit acknowledgement, so that
 * glancing at the page cannot silently clear work that was never reviewed.
 */
export function TasksReviewSection({ tasks, today }: TasksReviewSectionProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<TrainerTask | null>(null);

  const overdue = useMemo(
    () => tasks.filter((task) => isTaskOverdue(task, today)),
    [tasks, today],
  );
  const awaitingReview = useMemo(
    () => tasks.filter(isAwaitingReview),
    [tasks],
  );

  if (overdue.length === 0 && awaitingReview.length === 0) return null;

  const handleAcknowledge = async (taskId: string) => {
    setPendingId(taskId);
    try {
      const result = await acknowledgeTaskAction(taskId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    } catch {
      toast.error("שגיאה באישור המשימה");
    } finally {
      setPendingId(null);
    }
  };

  const handleAcknowledgeAll = async () => {
    setBulkLoading(true);
    try {
      const result = await acknowledgeAllTasksAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`אושרו ${result.count} משימות`);
      router.refresh();
    } catch {
      toast.error("שגיאה באישור המשימות");
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <>
      <Card className="border-amber-300 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            דורש תשומת לב
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {overdue.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                עברו דדליין ({overdue.length})
              </h3>
              <ul className="space-y-2">
                {overdue.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.assignee?.full_name ?? "ללא מאמן"} · יעד{" "}
                        {formatDueDate(task.due_date)}
                      </p>
                    </div>
                    <Badge variant="destructive">באיחור</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {awaitingReview.length > 0 && (
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  נסגרו וממתינות לבדיקה ({awaitingReview.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcknowledgeAll}
                  disabled={bulkLoading}
                >
                  {bulkLoading ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="me-2 h-4 w-4" />
                  )}
                  אישור הכל
                </Button>
              </div>

              <ul className="space-y-2">
                {awaitingReview.map((task) => (
                  <li key={task.id} className="space-y-2 rounded-md border px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.assignee?.full_name ?? "ללא מאמן"}
                          {task.completed_at
                            ? ` · נסגרה ${formatDateShort(task.completed_at)}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAcknowledge(task.id)}
                          disabled={pendingId === task.id}
                        >
                          {pendingId === task.id ? (
                            <Loader2 className="me-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="me-2 h-4 w-4" />
                          )}
                          אישור
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReopenTarget(task)}
                        >
                          <RotateCcw className="me-2 h-4 w-4" />
                          פתח מחדש
                        </Button>
                      </div>
                    </div>

                    {task.completion_note && (
                      <p className="whitespace-pre-wrap rounded bg-muted px-2 py-1 text-xs">
                        {task.completion_note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </CardContent>
      </Card>

      {reopenTarget && (
        <TaskNoteDialog
          key={reopenTarget.id}
          open
          onOpenChange={(next) => !next && setReopenTarget(null)}
          taskId={reopenTarget.id}
          taskTitle={reopenTarget.title}
          mode="reopen"
        />
      )}
    </>
  );
}
