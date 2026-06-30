"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Copy, Loader2 } from "lucide-react";
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
  createProgram,
  duplicateProgram,
  deleteProgram,
} from "@/features/workouts/lib/actions";
import type { WorkoutProgram } from "@/features/workouts/lib/types";

// ---------------------------------------------------------------------------
// CreateProgramDialog
// ---------------------------------------------------------------------------

interface CreateProgramDialogProps {
  open: boolean;
  onClose: () => void;
}

function CreateProgramDialog({ open, onClose }: CreateProgramDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [weeks, setWeeks] = useState<number>(8);

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createProgram({ name: name.trim(), weeks });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("תוכנית נוצרה בהצלחה");
      onClose();
      setName("");
      setWeeks(8);
      router.push(`/admin/workouts/programs/${result.programId}`);
    });
  };

  const isValid = name.trim().length > 0 && weeks >= 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>תוכנית חדשה</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="prog-name">שם התוכנית</Label>
            <Input
              id="prog-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="למשל: תוכנית כוח ו-8 שבועות"
              disabled={pending}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="prog-weeks">מספר שבועות</Label>
            <Input
              id="prog-weeks"
              type="number"
              min={1}
              max={52}
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              disabled={pending}
              dir="ltr"
              className="w-24"
            />
          </div>
        </div>

        <DialogFooter className="flex-row-reverse gap-2">
          <Button onClick={handleCreate} disabled={pending || !isValid}>
            {pending && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
            צור תוכנית
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
// ProgramCard
// ---------------------------------------------------------------------------

interface ProgramCardProps {
  program: WorkoutProgram;
  onRefresh: () => void;
}

function ProgramCard({ program, onRefresh }: ProgramCardProps) {
  const [duplicating, startDuplicate] = useTransition();

  const handleDuplicate = () => {
    startDuplicate(async () => {
      const result = await duplicateProgram(program.id);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("תוכנית שוכפלה בהצלחה");
      onRefresh();
    });
  };

  return (
    <div className="border rounded-lg p-4 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Link
          href={`/admin/workouts/programs/${program.id}`}
          className="font-semibold text-base hover:underline text-primary block truncate"
        >
          {program.name}
        </Link>
        <p className="text-sm text-muted-foreground mt-0.5">
          {program.weeks} שבועות
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDuplicate}
          disabled={duplicating}
          aria-label="שכפל תוכנית"
        >
          {duplicating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="ms-1 hidden sm:inline">שכפל</span>
        </Button>

        <DeleteConfirmDialog
          title={`מחיקת תוכנית: ${program.name}`}
          description="פעולה זו תמחק את התוכנית לצמיתות, כולל כל התרגילים והנתונים שלה."
          successMessage="תוכנית נמחקה"
          errorMessage="שגיאה במחיקת תוכנית"
          onDelete={() => deleteProgram(program.id)}
          onSuccess={onRefresh}
          trigger={
            <Button variant="ghost" size="sm" aria-label="מחק תוכנית">
              <span className="text-destructive text-sm">מחק</span>
            </Button>
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgramList — main client island
// ---------------------------------------------------------------------------

interface ProgramListProps {
  programs: WorkoutProgram[];
}

export function ProgramList({ programs }: ProgramListProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {programs.length} תוכניות
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 ms-2" />
          תוכנית חדשה
        </Button>
      </div>

      <CreateProgramDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {programs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          אין תוכניות אימון עדיין. לחץ &quot;תוכנית חדשה&quot; כדי להתחיל.
        </div>
      ) : (
        <div className="space-y-2">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
