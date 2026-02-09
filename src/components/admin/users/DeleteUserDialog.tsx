"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { softDeleteUserAction } from "@/lib/actions/admin-users";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import type { Profile } from "@/types/database";

interface DeleteUserDialogProps {
  user: Profile;
  currentUserId: string;
  trigger?: React.ReactNode;
}

export function DeleteUserDialog({ user, currentUserId, trigger }: DeleteUserDialogProps) {
  const router = useRouter();
  const isSelf = user.id === currentUserId;

  return (
    <DeleteConfirmDialog
      title="מחיקת משתמש"
      description={
        <>
          <p>האם אתה בטוח שברצונך למחוק את המשתמש <strong>{user.full_name}</strong>?</p>
          <p className="text-muted-foreground">
            המשתמש יסומן כמחוק אך הנתונים ישמרו במערכת.
            ניתן יהיה לשחזר את המשתמש בעתיד.
          </p>
        </>
      }
      confirmLabel="מחק משתמש"
      loadingLabel="מוחק..."
      successMessage="המשתמש נמחק בהצלחה"
      errorMessage="שגיאה במחיקת המשתמש"
      onDelete={() => softDeleteUserAction(user.id)}
      onSuccess={() => {
        router.push("/admin/users");
        router.refresh();
      }}
      disabled={isSelf}
      trigger={trigger || (
        <Button variant="destructive" disabled={isSelf}>
          <Trash2 className="h-4 w-4 ml-2" />
          מחיקת משתמש
        </Button>
      )}
    />
  );
}
