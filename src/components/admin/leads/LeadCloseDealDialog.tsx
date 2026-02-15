"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLeadAction } from "@/lib/actions/admin-leads";
import type { Lead } from "@/types/leads";

interface LeadCloseDealDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LeadCloseDealDialog({
  lead,
  open,
  onOpenChange,
  onSuccess,
}: LeadCloseDealDialogProps) {
  const router = useRouter();
  const [payment, setPayment] = useState<number | "">(lead.payment ?? "");
  const [months, setMonths] = useState<number | "">(lead.months ?? "");
  const [loading, setLoading] = useState(false);

  const total =
    typeof payment === "number" && typeof months === "number"
      ? payment * months
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof payment !== "number" || typeof months !== "number") return;

    setLoading(true);
    try {
      const result = await updateLeadAction({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        status: "closed",
        is_from_haifa: lead.is_from_haifa,
        payment,
        months,
        total_payment: payment * months,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("עסקה נסגרה בהצלחה!");
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch {
      toast.error("שגיאה בסגירת עסקה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-amber-600" />
            סגירת עסקה
          </DialogTitle>
          <DialogDescription>סגירת עסקה עבור {lead.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>תשלום חודשי (₪)</Label>
            <Input
              type="number"
              min={0}
              value={payment}
              onChange={(e) =>
                setPayment(e.target.value === "" ? "" : Number(e.target.value))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label>מספר חודשים</Label>
            <Input
              type="number"
              min={1}
              value={months}
              onChange={(e) =>
                setMonths(e.target.value === "" ? "" : Number(e.target.value))
              }
              required
            />
          </div>
          {total !== null && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-center">
              <p className="text-sm text-amber-700">סה״כ עסקה</p>
              <p className="text-3xl font-bold text-amber-900">
                {total.toLocaleString()}₪
              </p>
            </div>
          )}
          <Button
            type="submit"
            disabled={loading || total === null}
            className="w-full bg-amber-600 hover:bg-amber-700"
          >
            {loading && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
            סגור עסקה
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
