"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { UserDataExportButton } from "@/components/admin/exports/UserDataExportButton";
import type { Profile } from "@/types/database";

interface UserActionsCardProps {
  user: Profile;
  currentUserId: string;
}

export function UserActionsCard({ user, currentUserId }: UserActionsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>פעולות נוספות</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-4">
        <UserDataExportButton userId={user.id} userName={user.full_name || "משתמש"} />

        <DeleteUserDialog
          user={user}
          currentUserId={currentUserId}
        />
      </CardContent>
    </Card>
  );
}
