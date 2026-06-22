"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ChurnedColorPicker } from "./ChurnedColorPicker";
import { ChurnedCustomerRow } from "./ChurnedCustomerRow";
import { PasteChurnedDialog } from "./PasteChurnedDialog";
import {
  createChurnedCustomer,
  updateChurnedCustomer,
  deleteChurnedCustomer,
  type ChurnedCustomer,
} from "@/lib/actions/admin-churned-customers";
import type { NoteColor } from "@/lib/validations/churned-customers";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";

interface ChurnedCustomersTabProps {
  readonly rows: readonly ChurnedCustomer[];
  readonly setRows: Dispatch<SetStateAction<readonly ChurnedCustomer[]>>;
  readonly trainers: TrainerOption[];
}

export function ChurnedCustomersTab({
  rows,
  setRows,
  trainers,
}: ChurnedCustomersTabProps) {
  const [name, setName] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [noteColor, setNoteColor] = useState<NoteColor>("none");
  const [isPending, startTransition] = useTransition();

  const canAdd = name.trim().length > 0 && endDate.length > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    startTransition(async () => {
      const result = await createChurnedCustomer({
        name,
        endDate,
        note,
        noteColor,
      });
      if (result.error || !result.data) {
        toast.error(result.error ?? "שגיאה בשמירה");
        return;
      }
      setRows((prev) => [result.data!, ...prev]);
      setName("");
      setEndDate("");
      setNote("");
      setNoteColor("none");
      toast.success("נוסף");
    });
  };

  const handleUpdate = useCallback(
    async (
      id: string,
      patch: { name?: string; endDate?: string; note?: string; noteColor?: NoteColor },
    ) => {
      const result = await updateChurnedCustomer(id, patch);
      if (result.error || !result.data) {
        toast.error(result.error ?? "שגיאה בעדכון");
        return { error: result.error ?? "שגיאה" };
      }
      setRows((prev) => prev.map((r) => (r.id === id ? result.data! : r)));
      toast.success("עודכן");
      return { error: null };
    },
    [setRows],
  );

  const handleAssignTrainer = useCallback(
    async (id: string, trainerId: string | null) => {
      const result = await updateChurnedCustomer(id, {
        assignedTrainerId: trainerId,
      });
      if (result.error || !result.data) {
        toast.error(result.error ?? "שגיאה בשיוך מאמן");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === id ? result.data! : r)));
    },
    [setRows],
  );

  const handleDelete = useCallback(
    async (id: string): Promise<{ error: string } | { success: true }> => {
      const result = await deleteChurnedCustomer(id);
      if ("error" in result) return { error: result.error };
      setRows((prev) => prev.filter((r) => r.id !== id));
      return { success: true };
    },
    [setRows],
  );

  const handlePasted = useCallback(
    (inserted: readonly ChurnedCustomer[]) => {
      setRows((prev) => [...inserted, ...prev]);
    },
    [setRows],
  );

  return (
    <div className="space-y-4">
      <div className="rounded border p-3 space-y-2">
        <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_auto] items-center">
          <Input
            placeholder="שם לקוח"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="הערה (אופציונלי)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <ChurnedColorPicker value={noteColor} onChange={setNoteColor} />
          <Button onClick={handleAdd} disabled={!canAdd || isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin me-2" />
            ) : (
              <Plus className="h-4 w-4 me-2" />
            )}
            הוסף
          </Button>
        </div>
        <div className="flex justify-end">
          <PasteChurnedDialog onInserted={handlePasted} />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">אין רשומות</p>
      ) : (
        <div className="rounded border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-start">שם</th>
                <th className="p-2 text-start">תאריך סיום</th>
                <th className="p-2 text-start">הערות</th>
                <th className="p-2 text-start">מאמן משוייך</th>
                <th className="p-2 text-start">תאריך עדכון אחרון</th>
                <th className="p-2 text-start">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ChurnedCustomerRow
                  key={row.id}
                  row={row}
                  trainers={trainers}
                  onUpdate={handleUpdate}
                  onAssignTrainer={handleAssignTrainer}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
