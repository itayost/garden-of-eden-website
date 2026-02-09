"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteVideoAction } from "@/lib/actions/admin-videos";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import type { WorkoutVideo } from "@/types/database";

interface DeleteVideoDialogProps {
  video: WorkoutVideo;
  trigger?: React.ReactNode;
  onDeleted?: () => void;
}

export function DeleteVideoDialog({
  video,
  trigger,
  onDeleted,
}: DeleteVideoDialogProps) {
  return (
    <DeleteConfirmDialog
      title="מחיקת סרטון"
      description={
        <>
          <p>
            האם אתה בטוח שברצונך למחוק את הסרטון{" "}
            <strong>{video.title}</strong>?
          </p>
          <p className="text-muted-foreground">
            פעולה זו לא ניתנת לביטול. הסרטון יימחק לצמיתות.
          </p>
        </>
      }
      confirmLabel="מחק סרטון"
      loadingLabel="מוחק..."
      successMessage="הסרטון נמחק בהצלחה"
      errorMessage="שגיאה במחיקת הסרטון"
      onDelete={() => deleteVideoAction(video.id)}
      onSuccess={onDeleted}
      trigger={trigger || (
        <Button variant="destructive">
          <Trash2 className="h-4 w-4 ml-2" />
          מחיקה
        </Button>
      )}
    />
  );
}
