"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { contactLogSchema, type ContactLogInput } from "@/lib/validations/leads";
import { addContactLogAction } from "@/lib/actions/admin-leads";
import {
  LEAD_CONTACT_TYPE_LABELS,
  LEAD_OUTCOME_LABELS,
  type LeadContactType,
  type LeadContactOutcome,
} from "@/types/leads";

interface LeadContactLogFormProps {
  leadId: string;
  onSuccess?: () => void;
}

export function LeadContactLogForm({ leadId, onSuccess }: LeadContactLogFormProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactLogInput>({
    resolver: zodResolver(contactLogSchema),
    defaultValues: {
      lead_id: leadId,
      contact_type: undefined,
      rep: "",
      notes: "",
      outcome: undefined,
    },
  });

  const contactType = watch("contact_type");
  const outcome = watch("outcome");

  const onSubmit = async (data: ContactLogInput) => {
    setLoading(true);
    try {
      const result = await addContactLogAction(data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("רישום יצירת קשר נוסף בהצלחה");
      reset({ lead_id: leadId, contact_type: undefined, rep: "", notes: "", outcome: undefined });
      onSuccess?.();
    } catch {
      toast.error("שגיאה בהוספת רישום");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <input type="hidden" {...register("lead_id")} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">סוג יצירת קשר *</Label>
          <Select
            value={contactType || ""}
            onValueChange={(v) =>
              setValue("contact_type", v as LeadContactType, { shouldValidate: true })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר סוג" />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(LEAD_CONTACT_TYPE_LABELS) as [
                  LeadContactType,
                  string,
                ][]
              ).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.contact_type && (
            <p className="text-xs text-destructive">{errors.contact_type.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">תוצאה</Label>
          <Select
            value={outcome || ""}
            onValueChange={(v) =>
              setValue("outcome", v as LeadContactOutcome, { shouldValidate: true })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר תוצאה" />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(LEAD_OUTCOME_LABELS) as [
                  LeadContactOutcome,
                  string,
                ][]
              ).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">נציג</Label>
        <Input placeholder="שם הנציג" {...register("rep")} />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">הערות</Label>
        <Textarea
          placeholder="הערות על השיחה..."
          rows={2}
          {...register("notes")}
        />
      </div>

      <Button type="submit" size="sm" disabled={loading} className="w-full">
        {loading && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
        הוסף רישום
      </Button>
    </form>
  );
}
