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
import { softDeleteUserAction } from "@/lib/actions/admin-users";
import type { Profile } from "@/types/database";

interface DeleteUserDialogProps {
  user: Profile;
  currentUserId: string;
  trigger?: React.ReactNode;
}

export function DeleteUserDialog({ user, currentUserId, trigger }: DeleteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isSelf = user.id === currentUserId;

  const handleDelete = async () => {
    if (isSelf) {
      toast.error("לא ניתן למחוק את החשבון שלך");
      return;
    }

    setLoading(true);
    try {
      const result = await softDeleteUserAction(user.id);

      if (!("success" in result)) {
        toast.error(result.error);
        return;
      }

      toast.success("המשתמש נמחק בהצלחה");
      setOpen(false);
      router.push("/admin/users");
      router.refresh();
    } catch (error) {
      toast.error("שגיאה במחיקת המשתמש");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" disabled={isSelf}>
            <Trash2 className="h-4 w-4 ml-2" />
            מחיקת משתמש
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>מחיקת משתמש</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>האם אתה בטוח שברצונך למחוק את המשתמש <strong>{user.full_name}</strong>?</p>
            <p className="text-muted-foreground">
              המשתמש יסומן כמחוק אך הנתונים ישמרו במערכת.
              ניתן יהיה לשחזר את המשתמש בעתיד.
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
            disabled={loading || isSelf}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                מוחק...
              </>
            ) : (
              "מחק משתמש"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
