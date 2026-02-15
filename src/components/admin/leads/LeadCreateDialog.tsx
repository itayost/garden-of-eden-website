"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { leadCreateSchema, type LeadCreateInput } from "@/lib/validations/leads";
import { createLeadAction, sendWhatsAppFlowAction } from "@/lib/actions/admin-leads";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/types/leads";

interface LeadCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadCreateDialog({ open, onOpenChange }: LeadCreateDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [autoSendFlow, setAutoSendFlow] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadCreateInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(leadCreateSchema) as any,
    defaultValues: {
      name: "",
      phone: "",
      status: "new",
      is_from_haifa: false,
      note: "",
    },
  });

  const status = watch("status");
  const isFromHaifa = watch("is_from_haifa");

  const onSubmit = async (data: LeadCreateInput) => {
    setLoading(true);
    try {
      const result = await createLeadAction(data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (autoSendFlow) {
        try {
          const flowResult = await sendWhatsAppFlowAction(result.data.id);
          if ("error" in flowResult) {
            toast.success("ליד נוצר בהצלחה • שגיאה בשליחת Flow");
          } else {
            toast.success("ליד נוצר בהצלחה • תבנית Flow נשלחה");
          }
        } catch {
          toast.success("ליד נוצר בהצלחה • שגיאה בשליחת Flow");
        }
      } else {
        toast.success("ליד נוצר בהצלחה");
      }

      reset();
      setAutoSendFlow(true);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה ביצירת ליד");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ליד חדש</DialogTitle>
          <DialogDescription>הוספת ליד חדש למערכת</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">שם *</Label>
            <Input id="name" placeholder="שם מלא" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">טלפון *</Label>
            <div className="relative">
              <Input
                id="phone"
                dir="ltr"
                placeholder="050-1234567"
                {...register("phone")}
              />
            </div>
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>סטטוס</Label>
            <Select
              value={status}
              onValueChange={(v) =>
                setValue("status", v as LeadStatus, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(LEAD_STATUS_LABELS) as [LeadStatus, string][]
                )
                  .filter(([value]) => value !== "closed")
                  .map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_from_haifa"
              checked={isFromHaifa}
              onCheckedChange={(checked) =>
                setValue("is_from_haifa", checked === true)
              }
            />
            <Label htmlFor="is_from_haifa" className="cursor-pointer">
              מחיפה
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">הערה</Label>
            <Textarea
              id="note"
              placeholder="הערות נוספות..."
              rows={3}
              {...register("note")}
            />
            {errors.note && (
              <p className="text-xs text-destructive">{errors.note.message}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-send-flow"
              checked={autoSendFlow}
              onCheckedChange={(checked) => setAutoSendFlow(checked === true)}
            />
            <Label htmlFor="auto-send-flow" className="text-sm cursor-pointer">
              שלח תבנית WhatsApp Flow אוטומטית
            </Label>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              צור ליד
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
