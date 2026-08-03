"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Copy, MoreHorizontal, Pencil, RotateCcw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDueDate, isTaskOverdue } from "@/lib/utils/tasks";
import {
  TRAINER_TASK_STATUS_COLORS,
  TRAINER_TASK_STATUS_LABELS,
  type TrainerTask,
} from "@/types/tasks";

export interface TaskRowActions {
  onComplete: (task: TrainerTask) => void;
  onEdit: (task: TrainerTask) => void;
  onDuplicate: (task: TrainerTask) => void;
  onCancel: (task: TrainerTask) => void;
  onReopen: (task: TrainerTask) => void;
}

interface BuildColumnsArgs {
  isAdmin: boolean;
  /** Today in Israel, ISO YYYY-MM-DD. */
  today: string;
  currentUserId: string;
  actions: TaskRowActions;
}

export function buildTaskColumns({
  isAdmin,
  today,
  currentUserId,
  actions,
}: BuildColumnsArgs): ColumnDef<TrainerTask>[] {
  const columns: ColumnDef<TrainerTask>[] = [
    {
      accessorKey: "title",
      header: "משימה",
      cell: ({ row }) => {
        const task = row.original;
        return (
          <div className="min-w-0 max-w-xs">
            <p className="truncate font-medium">{task.title}</p>
            {task.description && (
              <p className="truncate text-xs text-muted-foreground">
                {task.description}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "assignee",
      header: "מאמן",
      accessorFn: (task) => task.assignee?.full_name ?? "",
      cell: ({ row }) => row.original.assignee?.full_name ?? "—",
    },
    {
      id: "trainee",
      header: "מתאמן",
      accessorFn: (task) => task.trainee?.full_name ?? "",
      cell: ({ row }) => {
        const task = row.original;
        if (!task.trainee_id) return <span className="text-muted-foreground">—</span>;
        return (
          <Link
            href={`/admin/users/${task.trainee_id}`}
            className="underline underline-offset-4 hover:no-underline"
          >
            {task.trainee?.full_name ?? "מתאמן"}
          </Link>
        );
      },
    },
    {
      accessorKey: "due_date",
      header: "תאריך יעד",
      cell: ({ row }) => {
        const task = row.original;
        const overdue = isTaskOverdue(task, today);
        return (
          <span className={overdue ? "font-medium text-destructive" : undefined}>
            {formatDueDate(task.due_date)}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "סטטוס",
      cell: ({ row }) => {
        const task = row.original;
        const overdue = isTaskOverdue(task, today);
        return (
          <div className="flex flex-wrap gap-1">
            <Badge className={TRAINER_TASK_STATUS_COLORS[task.status]}>
              {TRAINER_TASK_STATUS_LABELS[task.status]}
            </Badge>
            {overdue && <Badge variant="destructive">באיחור</Badge>}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const task = row.original;
        const isMine = task.assigned_to === currentUserId;
        const canClose = task.status === "open" && (isAdmin || isMine);

        return (
          <div className="flex items-center justify-end gap-2">
            {canClose && (
              <Button size="sm" onClick={() => actions.onComplete(task)}>
                בוצע
              </Button>
            )}

            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="פעולות נוספות">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => actions.onDuplicate(task)}>
                    <Copy className="me-2 h-4 w-4" />
                    שכפול
                  </DropdownMenuItem>
                  {task.status !== "cancelled" && (
                    <DropdownMenuItem onClick={() => actions.onEdit(task)}>
                      <Pencil className="me-2 h-4 w-4" />
                      עריכה
                    </DropdownMenuItem>
                  )}
                  {task.status === "done" && (
                    <DropdownMenuItem onClick={() => actions.onReopen(task)}>
                      <RotateCcw className="me-2 h-4 w-4" />
                      פתח מחדש
                    </DropdownMenuItem>
                  )}
                  {task.status === "open" && (
                    <DropdownMenuItem onClick={() => actions.onCancel(task)}>
                      <XCircle className="me-2 h-4 w-4" />
                      ביטול משימה
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      },
    },
  ];

  // A trainer only ever sees their own tasks, so the assignee column is noise.
  return isAdmin ? columns : columns.filter((column) => column.id !== "assignee");
}
