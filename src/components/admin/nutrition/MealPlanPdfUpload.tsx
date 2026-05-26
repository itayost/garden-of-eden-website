"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import {
  MEAL_PLAN_TYPE_LABELS_HE,
  type MealPlanType,
  type TraineeMealPlanRow,
} from "@/features/nutrition/types";
import { deleteMealPlanPdf, upsertMealPlanPdf } from "@/features/nutrition";
import {
  MEAL_PLAN_TYPES,
  pdfUrlFor,
} from "@/features/nutrition/lib/meal-plan-slots";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";

interface MealPlanPdfUploadProps {
  userId: string;
  existingPlan: TraineeMealPlanRow | null;
}

export function MealPlanPdfUpload({
  userId,
  existingPlan,
}: MealPlanPdfUploadProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          תפריטי תזונה (PDF)
        </CardTitle>
        <CardDescription>
          העלו תפריט נפרד ליום אימון וליום מנוחה
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {MEAL_PLAN_TYPES.map((planType) => (
          <MealPlanPdfSlot
            key={planType}
            userId={userId}
            planType={planType}
            existingUrl={pdfUrlFor(existingPlan, planType)}
            updatedAt={existingPlan?.updated_at ?? null}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface MealPlanPdfSlotProps {
  userId: string;
  planType: MealPlanType;
  existingUrl: string | null;
  updatedAt: string | null;
}

function MealPlanPdfSlot({
  userId,
  planType,
  existingUrl,
  updatedAt,
}: MealPlanPdfSlotProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const label = MEAL_PLAN_TYPE_LABELS_HE[planType];
  const hasPdf = !!existingUrl;
  const isLoading = isUploading || isPending;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("יש לבחור קובץ PDF בלבד");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("הקובץ גדול מדי. מקסימום 10MB");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("traineeUserId", userId);
      formData.append("planType", planType);

      const response = await fetch("/api/nutrition/upload-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "שגיאה בהעלאת הקובץ");
      }

      const { pdfUrl, pdfPath } = await response.json();

      startTransition(async () => {
        const result = await upsertMealPlanPdf(
          userId,
          planType,
          pdfUrl,
          pdfPath
        );
        if (result.success) {
          toast.success(`${label} הועלה בהצלחה`);
        } else {
          toast.error(result.error || "שגיאה בשמירת התפריט");
        }
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "שגיאה בהעלאת הקובץ"
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">{label}</h4>
      </div>

      {hasPdf ? (
        <>
          <div className="rounded-md bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 text-xs text-muted-foreground">
                {updatedAt
                  ? `עודכן: ${new Date(updatedAt).toLocaleDateString("he-IL")}`
                  : "תפריט קיים"}
              </div>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={existingUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 ml-1" />
                  צפייה
                </a>
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 ml-2" />
              )}
              {isLoading ? "מעלה..." : "החלף"}
            </Button>

            <DeleteConfirmDialog
              title={`מחיקת ${label}`}
              description="האם אתה בטוח שברצונך למחוק את התפריט? פעולה זו לא ניתנת לביטול."
              confirmLabel="מחק"
              successMessage="התפריט נמחק בהצלחה"
              errorMessage="שגיאה במחיקת התפריט"
              onDelete={async () => {
                const result = await deleteMealPlanPdf(userId, planType);
                if (result.success) return { success: true as const };
                return { error: result.error || "שגיאה במחיקה" };
              }}
              trigger={
                <Button variant="ghost" size="icon" disabled={isLoading}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              }
            />
          </div>
        </>
      ) : (
        <div
          className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          onClick={() => !isLoading && fileInputRef.current?.click()}
        >
          {isLoading ? (
            <div className="space-y-2">
              <Loader2 className="h-8 w-8 mx-auto text-muted-foreground animate-spin" />
              <p className="text-xs text-muted-foreground">מעלה קובץ...</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">העלאת PDF</p>
              <p className="text-xs text-muted-foreground">PDF בלבד, עד 10MB</p>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
