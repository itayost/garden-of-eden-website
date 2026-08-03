"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertBriefAction } from "@/lib/actions/daily-briefs";
import { dailyBriefSchema, type DailyBriefInput } from "@/lib/validations/tasks";

interface DailyBriefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ISO YYYY-MM-DD in Israel time — the day this brief belongs to. */
  briefDate: string;
  /** Existing content when editing, empty string when writing a new brief. */
  initialContent: string;
}

export function DailyBriefDialog({
  open,
  onOpenChange,
  briefDate,
  initialContent,
}: DailyBriefDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof dailyBriefSchema>, unknown, DailyBriefInput>({
    resolver: zodResolver(dailyBriefSchema),
    defaultValues: { briefDate, content: initialContent },
  });

  const onSubmit = async (data: DailyBriefInput) => {
    setLoading(true);
    try {
      const result = await upsertBriefAction(data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("הבריף נשמר");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת הבריף");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialContent ? "עריכת הבריף" : "בריף יומי"}</DialogTitle>
          <DialogDescription>
            מה שכל המאמנים צריכים לדעת היום. הבריף מוצג לכל הצוות.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("briefDate")} />

          <div className="space-y-2">
            <Label htmlFor="brief-content">תוכן הבריף</Label>
            <Textarea
              id="brief-content"
              rows={8}
              placeholder="לדוגמה: היום מגיע צלם ב-16:00, לוודא שהילדים במדים."
              {...register("content")}
            />
            {errors.content && (
              <p className="text-sm text-destructive">{errors.content.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              שמירה
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
