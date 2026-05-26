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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createLeadTabAction,
  updateLeadTabAction,
} from "@/lib/actions/admin-lead-tabs";
import {
  LEAD_TAB_COLORS,
  LEAD_TAB_COLOR_CLASSES,
  LEAD_TAB_COLOR_LABELS,
  type LeadTab,
  type LeadTabColor,
} from "@/types/lead-tabs";
import { cn } from "@/lib/utils";

interface LeadTabFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab?: LeadTab;
}

interface FormBodyProps {
  tab?: LeadTab;
  onOpenChange: (open: boolean) => void;
}

function FormBody({ tab, onOpenChange }: FormBodyProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(tab?.name ?? "");
  const [color, setColor] = useState<LeadTabColor | null>(tab?.color ?? null);
  const [isDefault, setIsDefault] = useState(tab?.is_default ?? false);

  const handleSubmit = () => {
    startTransition(async () => {
      const result = tab
        ? await updateLeadTabAction({
            id: tab.id,
            name,
            color,
            is_default: isDefault,
          })
        : await createLeadTabAction({
            name,
            color,
            is_default: isDefault,
          });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(tab ? "טאב עודכן" : "טאב נוצר");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tab-name">שם</Label>
          <Input
            id="tab-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="לדוגמה: קמפיין סתיו"
            maxLength={80}
          />
        </div>

        <div className="space-y-2">
          <Label>צבע</Label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setColor(null)}
              className={cn(
                "rounded-full px-3 py-1 text-xs border",
                color === null
                  ? "border-foreground"
                  : "border-transparent bg-gray-50 text-gray-600",
              )}
            >
              ללא
            </button>
            {LEAD_TAB_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs border",
                  LEAD_TAB_COLOR_CLASSES[c],
                  color === c ? "border-foreground" : "border-transparent",
                )}
                aria-label={LEAD_TAB_COLOR_LABELS[c]}
              >
                {LEAD_TAB_COLOR_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="tab-default"
            checked={isDefault}
            onCheckedChange={(v) => setIsDefault(v === true)}
          />
          <Label htmlFor="tab-default" className="cursor-pointer">
            קבע כברירת מחדל (לידים חדשים יגיעו לכאן)
          </Label>
        </div>
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
        <Button onClick={handleSubmit} disabled={pending || !name.trim()}>
          {pending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
          {tab ? "שמירה" : "יצירה"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function LeadTabFormDialog({
  open,
  onOpenChange,
  tab,
}: LeadTabFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tab ? "עריכת טאב" : "טאב חדש"}</DialogTitle>
          <DialogDescription>
            טאבים מארגנים את הלידים לקבוצות ניתנות להחלפה.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <FormBody
            key={tab?.id ?? "new"}
            tab={tab}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
