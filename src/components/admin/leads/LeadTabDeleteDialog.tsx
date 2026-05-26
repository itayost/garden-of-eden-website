"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { deleteLeadTabAction } from "@/lib/actions/admin-lead-tabs";
import type { LeadTab } from "@/types/lead-tabs";

interface LeadTabDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: LeadTab | null;
  otherTabs: LeadTab[];
}

interface DeleteBodyProps {
  tab: LeadTab;
  otherTabs: LeadTab[];
  onOpenChange: (open: boolean) => void;
}

function DeleteBody({ tab, otherTabs, onOpenChange }: DeleteBodyProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [destination, setDestination] = useState<string>(
    otherTabs[0]?.id ?? "",
  );

  const handleConfirm = () => {
    if (!destination) {
      toast.error("יש לבחור טאב יעד");
      return;
    }
    startTransition(async () => {
      const result = await deleteLeadTabAction({
        id: tab.id,
        move_to_tab_id: destination,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("הטאב נמחק");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <>
      <div className="space-y-2">
        <Label>טאב יעד</Label>
        <Select value={destination} onValueChange={setDestination} dir="rtl">
          <SelectTrigger className="w-full">
            <SelectValue placeholder="בחר טאב" />
          </SelectTrigger>
          <SelectContent>
            {otherTabs.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={pending}
        >
          ביטול
        </Button>
        <Button
          variant="destructive"
          onClick={handleConfirm}
          disabled={pending || !destination}
        >
          {pending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
          מחק והעבר
        </Button>
      </DialogFooter>
    </>
  );
}

export function LeadTabDeleteDialog({
  open,
  onOpenChange,
  tab,
  otherTabs,
}: LeadTabDeleteDialogProps) {
  if (!tab) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>מחיקת טאב</DialogTitle>
          <DialogDescription>
            כל הלידים בטאב &quot;{tab.name}&quot; יועברו לטאב היעד לפני המחיקה.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <DeleteBody
            key={tab.id}
            tab={tab}
            otherTabs={otherTabs}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
