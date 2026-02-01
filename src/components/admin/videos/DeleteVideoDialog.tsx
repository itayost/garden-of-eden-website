"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { deleteVideoAction } from "@/lib/actions/admin-videos";
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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const result = await deleteVideoAction(video.id);

      if (!("success" in result)) {
        toast.error(result.error);
        return;
      }

      toast.success("הסרטון נמחק בהצלחה");
      setOpen(false);
      onDeleted?.();
    } catch (error) {
      console.error("Delete video error:", error);
      toast.error("שגיאה במחיקת הסרטון");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="destructive">
            <Trash2 className="h-4 w-4 ml-2" />
            מחיקה
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>מחיקת סרטון</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              האם אתה בטוח שברצונך למחוק את הסרטון{" "}
              <strong>{video.title}</strong>?
            </p>
            <p className="text-muted-foreground">
              פעולה זו לא ניתנת לביטול. הסרטון יימחק לצמיתות.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                מוחק...
              </>
            ) : (
              "מחק סרטון"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
