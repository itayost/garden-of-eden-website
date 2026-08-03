"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/admin/TablePagination";
import { TableToolbar, ToolbarSelect } from "@/components/admin/TableToolbar";
import { cancelTaskAction } from "@/lib/actions/admin-tasks";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { isTaskOverdue } from "@/lib/utils/tasks";
import {
  TRAINER_TASK_STATUSES,
  TRAINER_TASK_STATUS_LABELS,
  type TrainerTask,
} from "@/types/tasks";
import { TaskCreateDialog, type TaskCreateDefaults } from "./TaskCreateDialog";
import { TaskEditDialog } from "./TaskEditDialog";
import { TaskNoteDialog } from "./TaskNoteDialog";
import { buildTaskColumns } from "./TaskTableColumns";

interface TaskDataTableProps {
  tasks: TrainerTask[];
  isAdmin: boolean;
  currentUserId: string;
  trainers: TrainerOption[];
  trainees: TrainerOption[];
  /** Today in Israel, ISO YYYY-MM-DD. */
  today: string;
}

const ALL = "all";
const OVERDUE = "overdue";

export function TaskDataTable({
  tasks,
  isAdmin,
  currentUserId,
  trainers,
  trainees,
  today,
}: TaskDataTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [trainerFilter, setTrainerFilter] = useState<string>(ALL);

  const [createDefaults, setCreateDefaults] = useState<TaskCreateDefaults | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  // Bumped on every open so the create dialog remounts with fresh defaults.
  // Keying on the title alone would go stale when duplicating two different
  // tasks that happen to share one.
  const [createInstance, setCreateInstance] = useState(0);
  const [editTarget, setEditTarget] = useState<TrainerTask | null>(null);
  const [noteTarget, setNoteTarget] = useState<{
    task: TrainerTask;
    mode: "complete" | "reopen";
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TrainerTask | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const handleCancelTask = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      const result = await cancelTaskAction(cancelTarget.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("המשימה בוטלה");
      setCancelTarget(null);
      router.refresh();
    } catch {
      toast.error("שגיאה בביטול המשימה");
    } finally {
      setCancelLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter === OVERDUE) {
        if (!isTaskOverdue(task, today)) return false;
      } else if (statusFilter !== ALL && task.status !== statusFilter) {
        return false;
      }

      if (trainerFilter !== ALL && task.assigned_to !== trainerFilter) return false;

      if (!term) return true;
      return [task.title, task.description, task.trainee?.full_name]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term));
    });
  }, [tasks, search, statusFilter, trainerFilter, today]);

  const columns = useMemo(
    () =>
      buildTaskColumns({
        isAdmin,
        today,
        currentUserId,
        actions: {
          onComplete: (task) => setNoteTarget({ task, mode: "complete" }),
          onReopen: (task) => setNoteTarget({ task, mode: "reopen" }),
          onEdit: (task) => setEditTarget(task),
          onCancel: (task) => setCancelTarget(task),
          onDuplicate: (task) => {
            setCreateDefaults({
              title: task.title,
              description: task.description ?? "",
              traineeId: task.trainee_id,
              trainerIds: [task.assigned_to],
            });
            setCreateInstance((n) => n + 1);
            setCreateOpen(true);
          },
        },
      }),
    [isAdmin, today, currentUserId],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const statusOptions = [
    { value: "all", label: "כל הסטטוסים" },
    ...TRAINER_TASK_STATUSES.map((status) => ({
      value: status,
      label: TRAINER_TASK_STATUS_LABELS[status],
    })),
    { value: OVERDUE, label: "באיחור" },
  ];

  const trainerOptions = [
    { value: ALL, label: "כל המאמנים" },
    ...trainers.map((trainer) => ({
      value: trainer.id,
      label: trainer.full_name ?? "ללא שם",
    })),
  ];

  return (
    <Card>
      <CardContent className="space-y-4">
        <TableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="חיפוש משימה..."
          filters={
            <>
              <ToolbarSelect
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={statusOptions}
              />
              {isAdmin && (
                <ToolbarSelect
                  value={trainerFilter}
                  onValueChange={setTrainerFilter}
                  options={trainerOptions}
                />
              )}
            </>
          }
          actions={
            isAdmin && (
              <Button
                onClick={() => {
                  setCreateDefaults(undefined);
                  setCreateInstance((n) => n + 1);
                  setCreateOpen(true);
                }}
              >
                <Plus className="me-2 h-4 w-4" />
                משימה חדשה
              </Button>
            )
          }
        />

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  אין משימות להצגה
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <TablePagination table={table} itemLabel="משימות" />
      </CardContent>

      {isAdmin && (
        <TaskCreateDialog
          // Remount so a duplicate prefills its values: defaultValues only
          // apply on mount.
          key={createInstance}
          open={createOpen}
          onOpenChange={setCreateOpen}
          trainers={trainers}
          trainees={trainees}
          today={today}
          defaults={createDefaults}
        />
      )}

      {isAdmin && editTarget && (
        <TaskEditDialog
          key={editTarget.id}
          open
          onOpenChange={(next) => !next && setEditTarget(null)}
          task={editTarget}
          trainers={trainers}
          trainees={trainees}
        />
      )}

      {noteTarget && (
        <TaskNoteDialog
          key={`${noteTarget.task.id}-${noteTarget.mode}`}
          open
          onOpenChange={(next) => !next && setNoteTarget(null)}
          taskId={noteTarget.task.id}
          taskTitle={noteTarget.task.title}
          mode={noteTarget.mode}
        />
      )}

      {/*
        A controlled AlertDialog rather than the shared DeleteConfirmDialog:
        that component owns its own open state behind a trigger, so it cannot be
        opened from a dropdown menu item.
      */}
      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(next) => !next && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ביטול משימה</AlertDialogTitle>
            <AlertDialogDescription>
              המשימה &quot;{cancelTarget?.title}&quot; תסומן כמבוטלת. היא לא נמחקת
              ונשארת בהיסטוריה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLoading}>חזרה</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleCancelTask();
              }}
              disabled={cancelLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelLoading ? "מבטל..." : "ביטול המשימה"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
