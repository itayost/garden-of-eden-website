"use client";

import { useState, useRef, useTransition } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Trash2, Loader2, ExternalLink } from "lucide-react";
import type { TraineeMealPlanRow } from "@/features/nutrition/types";
import { upsertMealPlanPdf, deleteMealPlanPdf } from "@/features/nutrition";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";

interface MealPlanPdfUploadProps {
  userId: string;
  existingPlan: TraineeMealPlanRow | null;
}

export function MealPlanPdfUpload({
  userId,
  existingPlan,
}: MealPlanPdfUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasPdf = !!existingPlan?.pdf_url;

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
      // Upload to API
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("traineeUserId", userId);

      const response = await fetch("/api/nutrition/upload-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "שגיאה בהעלאת הקובץ");
      }

      const { pdfUrl, pdfPath } = await response.json();

      // Save to database
      startTransition(async () => {
        const result = await upsertMealPlanPdf(userId, pdfUrl, pdfPath);
        if (result.success) {
          toast.success("תפריט PDF הועלה בהצלחה");
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
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const isLoading = isUploading || isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          תפריט תזונה (PDF)
        </CardTitle>
        <CardDescription>
          העלו קובץ PDF עם תפריט תזונה מוכן לחניך
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPdf ? (
          <>
            {/* Current PDF preview */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-8 w-8 text-red-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">תפריט PDF קיים</p>
                    <p className="text-xs text-muted-foreground">
                      עודכן לאחרונה:{" "}
                      {new Date(existingPlan!.updated_at).toLocaleDateString(
                        "he-IL"
                      )}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={existingPlan!.pdf_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 ml-1" />
                    צפייה
                  </a>
                </Button>
              </div>
            </div>

            {/* Replace / Delete buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 ml-2" />
                )}
                {isLoading ? "מעלה..." : "החלף PDF"}
              </Button>

              <DeleteConfirmDialog
                title="מחיקת תפריט"
                description="האם אתה בטוח שברצונך למחוק את התפריט? פעולה זו לא ניתנת לביטול."
                confirmLabel="מחק"
                successMessage="התפריט נמחק בהצלחה"
                errorMessage="שגיאה במחיקת התפריט"
                onDelete={async () => {
                  const result = await deleteMealPlanPdf(userId);
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
          /* Upload area - no existing PDF */
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
            onClick={() => !isLoading && fileInputRef.current?.click()}
          >
            {isLoading ? (
              <div className="space-y-2">
                <Loader2 className="h-10 w-10 mx-auto text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground">מעלה קובץ...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">לחצו להעלאת קובץ PDF</p>
                <p className="text-xs text-muted-foreground">
                  PDF בלבד, עד 10MB
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </CardContent>
    </Card>
  );
}
