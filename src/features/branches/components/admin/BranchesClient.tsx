"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createBranchAction,
  reorderBranchesAction,
  updateBranchAction,
  type BranchInput,
  type BranchWithCount,
} from "@/features/branches/lib/actions/admin-branches";

interface BranchDialogProps {
  open: boolean;
  branch?: BranchWithCount;
  onClose: () => void;
  onSaved: () => void;
}

function BranchDialog({ open, branch, onClose, onSaved }: BranchDialogProps) {
  const [pending, startTransition] = useTransition();
  const [nameHe, setNameHe] = useState(branch?.name_he ?? "");
  const [arboxName, setArboxName] = useState(branch?.arbox_location_name ?? "");
  const [isActive, setIsActive] = useState(branch?.is_active ?? true);

  const isEdit = Boolean(branch);

  const handleSave = () => {
    const input: BranchInput = {
      name_he: nameHe.trim(),
      arbox_location_name: arboxName.trim() || null,
      is_active: isActive,
    };

    startTransition(async () => {
      const result =
        isEdit && branch
          ? await updateBranchAction(branch.id, input)
          : await createBranchAction(input);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "הסניף עודכן" : "הסניף נוצר");
      onSaved();
      onClose();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת סניף" : "סניף חדש"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="branch-name">שם הסניף</Label>
            <Input
              id="branch-name"
              value={nameHe}
              onChange={(e) => setNameHe(e.target.value)}
              placeholder="למשל: קריית אתא"
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="branch-arbox">שם המיקום ב-Arbox (אופציונלי)</Label>
            <Input
              id="branch-arbox"
              value={arboxName}
              onChange={(e) => setArboxName(e.target.value)}
              placeholder="כפי שמופיע בדוח הלקוחות של Arbox"
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              כשהשם תואם, הסנכרון הלילי משייך מתאמנים חדשים לסניף הזה אוטומטית.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="branch-active">סניף פעיל</Label>
              <p className="text-xs text-muted-foreground">
                סניף לא פעיל לא מופיע בבחירה, אבל השיוכים וההיסטוריה נשמרים.
              </p>
            </div>
            <Switch
              id="branch-active"
              checked={isActive}
              onCheckedChange={setIsActive}
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

interface BranchesClientProps {
  initialBranches: BranchWithCount[];
}

export function BranchesClient({ initialBranches }: BranchesClientProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<BranchWithCount | null>(null);
  const [reordering, startReorder] = useTransition();

  const refresh = () => router.refresh();

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= initialBranches.length) return;
    const ids = initialBranches.map((b) => b.id);
    const reordered = ids.map((id, i) => {
      if (i === index) return ids[target];
      if (i === target) return ids[index];
      return id;
    });
    startReorder(async () => {
      const result = await reorderBranchesAction(reordered);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{initialBranches.length} סניפים</p>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 ms-2" />
          סניף חדש
        </Button>
      </div>

      <BranchDialog open={addOpen} onClose={() => setAddOpen(false)} onSaved={refresh} />

      {editBranch && (
        <BranchDialog
          key={editBranch.id}
          open={true}
          branch={editBranch}
          onClose={() => setEditBranch(null)}
          onSaved={refresh}
        />
      )}

      {initialBranches.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          אין סניפים עדיין.
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {initialBranches.map((branch, index) => (
            <div
              key={branch.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-medium truncate">{branch.name_he}</span>
                {!branch.is_active && <Badge variant="outline">לא פעיל</Badge>}
                <span className="text-xs text-muted-foreground">
                  {branch.memberCount} משתמשים
                </span>
                {branch.arbox_location_name && (
                  <span className="text-xs text-muted-foreground truncate">
                    Arbox: {branch.arbox_location_name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, -1)}
                  disabled={reordering || index === 0}
                  aria-label={`העבר למעלה ${branch.name_he}`}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, 1)}
                  disabled={reordering || index === initialBranches.length - 1}
                  aria-label={`העבר למטה ${branch.name_he}`}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditBranch(branch)}
                  aria-label={`ערוך סניף ${branch.name_he}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
