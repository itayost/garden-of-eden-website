"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LeadTabBadge } from "./LeadTabBadge";
import { LeadTabFormDialog } from "./LeadTabFormDialog";
import { LeadTabDeleteDialog } from "./LeadTabDeleteDialog";
import { reorderLeadTabsAction } from "@/lib/actions/admin-lead-tabs";
import type { LeadTab } from "@/types/lead-tabs";

interface LeadTabsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabs: LeadTab[];
}

export function LeadTabsManager({
  open,
  onOpenChange,
  tabs,
}: LeadTabsManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<LeadTab | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<LeadTab | null>(null);

  const ordered = useMemo(
    () => [...tabs].sort((a, b) => a.position - b.position),
    [tabs],
  );

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    startTransition(async () => {
      const result = await reorderLeadTabsAction({
        ordered_ids: next.map((t) => t.id),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ניהול טאבים</DialogTitle>
            <DialogDescription>
              צור, ערוך, סדר וקבע ברירת מחדל לטאבים של הלידים.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {ordered.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-md border p-2"
              >
                <LeadTabBadge tab={t} className="shrink-0" />
                <span className="flex-1 text-sm truncate">{t.name}</span>
                {t.is_default && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    ברירת מחדל
                  </span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="העלה"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending || i === ordered.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="הורד"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setEditing(t)}
                  aria-label="ערוך"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending || ordered.length <= 1}
                  onClick={() => setDeleting(t)}
                  aria-label="מחק"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button onClick={() => setCreating(true)} disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 ml-2" />
              )}
              טאב חדש
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LeadTabFormDialog
        open={creating}
        onOpenChange={setCreating}
      />
      <LeadTabFormDialog
        open={editing !== undefined}
        onOpenChange={(o) => !o && setEditing(undefined)}
        tab={editing}
      />
      <LeadTabDeleteDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        tab={deleting}
        otherTabs={ordered.filter((t) => t.id !== deleting?.id)}
      />
    </>
  );
}
