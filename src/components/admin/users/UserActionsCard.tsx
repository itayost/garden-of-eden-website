"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { resetUserCredentialsAction } from "@/lib/actions/admin-users";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { UserDataExportButton } from "@/components/admin/exports/UserDataExportButton";
import type { Profile } from "@/types/database";

interface UserActionsCardProps {
  user: Profile;
  currentUserId: string;
}

export function UserActionsCard({ user, currentUserId }: UserActionsCardProps) {
  const [resetLoading, setResetLoading] = useState(false);

  const handleResetCredentials = async () => {
    setResetLoading(true);
    try {
      const result = await resetUserCredentialsAction(user.id);

      if (!("success" in result)) {
        toast.error(result.error);
        return;
      }

      // Show message from server if available
      if (result.message) {
        toast.success(result.message);
      } else {
        toast.success("נשלח אימייל לאיפוס סיסמה");
      }
    } catch {
      toast.error("שגיאה באיפוס הסיסמה");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>פעולות נוספות</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-4">
        <Button
          variant="outline"
          onClick={handleResetCredentials}
          disabled={resetLoading}
        >
          {resetLoading ? (
            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4 ml-2" />
          )}
          איפוס סיסמה
        </Button>

        <UserDataExportButton userId={user.id} userName={user.full_name || "משתמש"} />

        <DeleteUserDialog
          user={user}
          currentUserId={currentUserId}
        />
      </CardContent>
    </Card>
  );
}
