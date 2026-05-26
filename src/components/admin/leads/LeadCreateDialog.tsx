"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { TrainerAssignmentSelect } from "./TrainerAssignmentSelect";
import {
  leadCreateSchema,
  parseBirthYearInput,
  type LeadCreateInput,
} from "@/lib/validations/leads";
import { createLeadAction, sendWhatsAppFlowAction } from "@/lib/actions/admin-leads";
import {
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  type LeadSource,
  type LeadStatus,
} from "@/types/leads";
import type { LeadTab } from "@/types/lead-tabs";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";

interface LeadCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTabId: string;
  tabs: LeadTab[];
  trainers: TrainerOption[];
}

function buildLeadDefaults(
  defaultTabId: string,
): z.input<typeof leadCreateSchema> {
  return {
    name: "",
    phone: "",
    status: "new",
    // Manual creates default to "organic"; paid leads come via the webhook.
    source: "organic",
    tab_id: defaultTabId,
    is_from_haifa: false,
    note: "",
    club: "",
    birth_year: null,
    additional_info: "",
    assigned_trainer_id: null,
  };
}

export function LeadCreateDialog({
  open,
  onOpenChange,
  defaultTabId,
  tabs,
  trainers,
}: LeadCreateDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [autoSendFlow, setAutoSendFlow] = useState(
    tabs.find((t) => t.id === defaultTabId)?.slug === "paid",
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof leadCreateSchema>, unknown, LeadCreateInput>({
    resolver: zodResolver(leadCreateSchema),
    defaultValues: buildLeadDefaults(defaultTabId),
  });

  // Keep tab_id in sync if the active tab changes while the dialog is mounted
  useEffect(() => {
    setValue("tab_id", defaultTabId);
    setAutoSendFlow(tabs.find((t) => t.id === defaultTabId)?.slug === "paid");
  }, [defaultTabId, tabs, setValue]);

  const status = watch("status");
  const tabId = watch("tab_id");
  const source = watch("source");
  const isFromHaifa = watch("is_from_haifa");
  const assignedTrainerId = watch("assigned_trainer_id");

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

      reset(buildLeadDefaults(defaultTabId));
      setAutoSendFlow(tabs.find((t) => t.id === defaultTabId)?.slug === "paid");
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

          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-2">
              <Label>טאב</Label>
              <Select
                value={tabId ?? defaultTabId}
                onValueChange={(v) =>
                  setValue("tab_id", v, { shouldDirty: true, shouldValidate: true })
                }
                dir="rtl"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tabs.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>מקור</Label>
            <Select
              value={source ?? "organic"}
              onValueChange={(v) =>
                setValue("source", v as LeadSource, { shouldValidate: true })
              }
              dir="rtl"
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_SOURCE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="club">מועדון</Label>
              <Input id="club" placeholder="שם המועדון" {...register("club")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth_year">שנתון</Label>
              <Input
                id="birth_year"
                type="number"
                inputMode="numeric"
                min={1990}
                max={2030}
                placeholder="למשל 2014"
                {...register("birth_year", { setValueAs: parseBirthYearInput })}
              />
              {errors.birth_year && (
                <p className="text-xs text-destructive">
                  {errors.birth_year.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>מאמן משוייך</Label>
            <TrainerAssignmentSelect
              trainers={trainers}
              value={assignedTrainerId ?? null}
              onChange={(id) =>
                setValue("assigned_trainer_id", id, { shouldDirty: true })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="additional_info">מידע נוסף</Label>
            <Textarea
              id="additional_info"
              rows={2}
              placeholder="פרטי רקע, היסטוריה, וכו'"
              {...register("additional_info")}
            />
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
            <Label htmlFor="note">הערות</Label>
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
