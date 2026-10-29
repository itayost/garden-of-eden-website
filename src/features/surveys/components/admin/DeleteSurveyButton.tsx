"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { deleteSurveyAction } from "../../lib/actions/delete-survey";

/** Deletes a Survey nobody has answered, after a confirmation, and goes back to the list. */
export function DeleteSurveyButton({ surveyId }: { surveyId: string }) {
  const router = useRouter();
  return (
    <DeleteConfirmDialog
      title="למחוק את הסקר?"
      description="הסקר והשאלות שלו יימחקו, ואי אפשר לשחזר אותם."
      confirmLabel="מחיקה"
      loadingLabel="מוחק..."
      successMessage="הסקר נמחק"
      errorMessage="המחיקה נכשלה. נסו שוב."
      onDelete={() => deleteSurveyAction(surveyId)}
      onSuccess={() => router.push("/admin/surveys")}
      trigger={
        <Button type="button" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 aria-hidden="true" />
          מחיקת הסקר
        </Button>
      }
    />
  );
}
