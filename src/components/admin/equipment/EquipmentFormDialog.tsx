"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createEquipmentAction,
  updateEquipmentAction,
} from "@/lib/actions/equipment";
import type { Equipment } from "@/types/equipment";

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null = create. Parent remounts via key so state initializes fresh. */
  equipment: Equipment | null;
}

export function EquipmentFormDialog({
  open,
  onOpenChange,
  equipment,
}: EquipmentFormDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(equipment?.name_he ?? "");
  const [notes, setNotes] = useState(equipment?.notes_he ?? "");
  const [isActive, setIsActive] = useState(equipment?.is_active ?? true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = equipment
        ? await updateEquipmentAction({
            equipmentId: equipment.id,
            name,
            notes,
            isActive,
          })
        : await createEquipmentAction({ name, notes });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(equipment ? "הציוד עודכן" : "הציוד נוצר — אפשר להדפיס מדבקה");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת הציוד");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{equipment ? "עריכת ציוד" : "ציוד חדש"}</DialogTitle>
          <DialogDescription>
            {equipment
              ? "הקוד וה-QR לא משתנים — המדבקות שהודפסו נשארות תקפות."
              : "קוד ה-QR נוצר אוטומטית עם השמירה."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="equipment-name">שם</Label>
            <Input
              id="equipment-name"
              value={name}
              placeholder="לדוגמה: מתקן סקוואט"
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipment-notes">הערות (אופציונלי)</Label>
            <Textarea
              id="equipment-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {equipment && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="equipment-active">פעיל</Label>
                <p className="text-xs text-muted-foreground">
                  ציוד לא פעיל לא נסרק ולא מופיע בבחירת תרגילים.
                </p>
              </div>
              <Switch
                id="equipment-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              שמירה
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
