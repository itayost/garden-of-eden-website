"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { softDeleteAssessmentAction } from "@/lib/actions/admin-assessments";

interface DeleteAssessmentDialogProps {
  assessmentId: string;
  assessmentDate: string;
  trigger?: React.ReactNode;
}

export function DeleteAssessmentDialog({
  assessmentId,
  assessmentDate,
  trigger,
}: DeleteAssessmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const formattedDate = new Date(assessmentDate).toLocaleDateString("he-IL");

  const handleDelete = async () => {
    setLoading(true);
    try {
      const result = await softDeleteAssessmentAction(assessmentId);

      if (!("success" in result)) {
        toast.error(result.error);
        return;
      }

      toast.success("המבדק נמחק בהצלחה");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error("שגיאה במחיקת המבדק");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon">
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>מחיקת מבדק</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>האם אתה בטוח שברצונך למחוק את המבדק מתאריך <strong>{formattedDate}</strong>?</p>
            <p className="text-muted-foreground">
              המבדק יסומן כמחוק אך הנתונים ישמרו במערכת.
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
              "מחק מבדק"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
