"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import {
  createMuscle,
  updateMuscle,
  deleteMuscle,
} from "@/features/development-book/lib/actions/admin-book-muscles";
import type { BookMuscle, MuscleInput } from "@/features/development-book/lib/actions/admin-book-muscles";

// ---------------------------------------------------------------------------
// Add / Edit muscle dialog
// ---------------------------------------------------------------------------

interface MuscleDialogProps {
  open: boolean;
  muscle?: BookMuscle;
  onClose: () => void;
  onSaved: () => void;
}

function MuscleDialog({ open, muscle, onClose, onSaved }: MuscleDialogProps) {
  const [pending, startTransition] = useTransition();
  const [nameHe, setNameHe] = useState(muscle?.nameHe ?? "");
  const [emoji, setEmoji] = useState(muscle?.emoji ?? "");

  const isEdit = Boolean(muscle);

  const handleSave = () => {
    const input: MuscleInput = {
      name_he: nameHe.trim(),
      emoji: emoji.trim() || null,
    };

    startTransition(async () => {
      const result = isEdit && muscle
        ? await updateMuscle(muscle.id, input)
        : await createMuscle(input);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "שריר עודכן" : "שריר נוצר");
      onSaved();
      onClose();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת שריר" : "שריר חדש"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="muscle-name">שם (עברית)</Label>
            <Input
              id="muscle-name"
              value={nameHe}
              onChange={(e) => setNameHe(e.target.value)}
              placeholder="למשל: ירך קדמית"
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="muscle-emoji">אמוג&#39;י (אופציונלי)</Label>
            <Input
              id="muscle-emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="הזן אמוג&#39;י"
              disabled={pending}
            />
          </div>
        </div>
        <DialogFooter className="flex-row-reverse gap-2">
          <Button onClick={handleSave} disabled={pending || !nameHe.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin ms-2" /> : null}
            שמור
          </Button>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// MusclesClient — main client island
// ---------------------------------------------------------------------------

interface MusclesClientProps {
  initialMuscles: BookMuscle[];
}

export function MusclesClient({ initialMuscles }: MusclesClientProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editMuscle, setEditMuscle] = useState<BookMuscle | null>(null);

  const refresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {initialMuscles.length} שרירים
        </p>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 ms-2" />
          שריר חדש
        </Button>
      </div>

      <MuscleDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={refresh}
      />

      {editMuscle && (
        <MuscleDialog
          key={editMuscle.id}
          open={true}
          muscle={editMuscle}
          onClose={() => setEditMuscle(null)}
          onSaved={refresh}
        />
      )}

      {initialMuscles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          אין שרירים עדיין. לחץ &ldquo;שריר חדש&rdquo; כדי להתחיל.
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {initialMuscles.map((muscle) => (
            <div
              key={muscle.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {muscle.emoji && (
                  <span className="text-xl shrink-0" aria-hidden="true">
                    {muscle.emoji}
                  </span>
                )}
                <span className="font-medium truncate">{muscle.nameHe}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditMuscle(muscle)}
                  aria-label={`ערוך שריר ${muscle.nameHe}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <DeleteConfirmDialog
                  title={`מחיקת שריר: ${muscle.nameHe}`}
                  description="פעולה זו תמחק את השריר לצמיתות."
                  successMessage="שריר נמחק"
                  errorMessage="שגיאה במחיקת שריר"
                  onDelete={() => deleteMuscle(muscle.id)}
                  onSuccess={refresh}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      aria-label={`מחק שריר ${muscle.nameHe}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
