"use client";

import { memo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { ChurnedColorPicker } from "./ChurnedColorPicker";
import { TrainerAssignmentSelect } from "@/components/admin/leads/TrainerAssignmentSelect";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { formatDateShort, formatRelativeTime } from "@/lib/utils/date";
import type { ChurnedCustomer } from "@/lib/actions/admin-churned-customers";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import {
  NOTE_COLOR_BG,
  type NoteColor,
} from "@/lib/validations/churned-customers";

type DeleteResult = { error: string } | { success: true };

interface ChurnedCustomerRowProps {
  readonly row: ChurnedCustomer;
  readonly trainers: TrainerOption[];
  readonly onUpdate: (
    id: string,
    patch: { name?: string; endDate?: string; note?: string; noteColor?: NoteColor },
  ) => Promise<{ error: string | null }>;
  readonly onAssignTrainer: (
    id: string,
    trainerId: string | null,
  ) => Promise<void>;
  readonly onDelete: (id: string) => Promise<DeleteResult>;
}

function ChurnedCustomerRowInner({
  row,
  trainers,
  onUpdate,
  onAssignTrainer,
  onDelete,
}: ChurnedCustomerRowProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(row.name);
  const [endDate, setEndDate] = useState(row.end_date);
  const [note, setNote] = useState(row.note);
  const [noteColor, setNoteColor] = useState<NoteColor>(row.note_color);

  const reset = () => {
    setName(row.name);
    setEndDate(row.end_date);
    setNote(row.note);
    setNoteColor(row.note_color);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await onUpdate(row.id, { name, endDate, note, noteColor });
    setSaving(false);
    if (!result.error) setEditing(false);
  };

  const handleCancel = () => {
    reset();
    setEditing(false);
  };

  const trainerCell = (
    <td className="p-2">
      <TrainerAssignmentSelect
        trainers={trainers}
        value={row.assigned_trainer_id}
        onChange={(trainerId) => onAssignTrainer(row.id, trainerId)}
        triggerClassName="w-40"
      />
    </td>
  );

  const updatedAtCell = (
    <td className="p-2 whitespace-nowrap text-muted-foreground">
      {formatRelativeTime(row.updated_at)}
    </td>
  );

  if (editing) {
    return (
      <tr className="border-b">
        <td className="p-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </td>
        <td className="p-2">
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </td>
        <td className="p-2">
          <div className="flex items-center gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
            <ChurnedColorPicker value={noteColor} onChange={setNoteColor} />
          </div>
        </td>
        {trainerCell}
        {updatedAtCell}
        <td className="p-2">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSave}
              disabled={saving}
              aria-label="שמור"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCancel}
              disabled={saving}
              aria-label="ביטול"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b">
      <td className="p-2">{row.name}</td>
      <td className="p-2 whitespace-nowrap">{formatDateShort(row.end_date)}</td>
      <td className={`p-2 ${NOTE_COLOR_BG[row.note_color]}`}>{row.note}</td>
      {trainerCell}
      {updatedAtCell}
      <td className="p-2">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditing(true)}
            aria-label="ערוך"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <DeleteConfirmDialog
            title="מחיקת רשומה"
            description={`למחוק את ${row.name}?`}
            successMessage="הרשומה נמחקה"
            errorMessage="שגיאה במחיקה"
            onDelete={() => onDelete(row.id)}
            trigger={
              <Button size="icon" variant="ghost" aria-label="מחק">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            }
          />
        </div>
      </td>
    </tr>
  );
}

export const ChurnedCustomerRow = memo(ChurnedCustomerRowInner);
