"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bulkAssignBranchAction } from "@/lib/actions/admin-users";
import type { BranchOption } from "@/types/branches";

interface BulkBranchAssignBarProps {
  selectedUserIds: string[];
  branches: BranchOption[];
  onDone: () => void;
}

export function BulkBranchAssignBar({
  selectedUserIds,
  branches,
  onDone,
}: BulkBranchAssignBarProps) {
  const router = useRouter();
  const [branchId, setBranchId] = useState("");
  const [pending, startTransition] = useTransition();

  if (selectedUserIds.length === 0) return null;

  const handleAssign = () => {
    if (!branchId) {
      toast.error("יש לבחור סניף");
      return;
    }
    startTransition(async () => {
      const result = await bulkAssignBranchAction({ userIds: selectedUserIds, branchId });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.assigned} משתמשים שויכו לסניף`);
      onDone();
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
      <span className="text-sm font-medium">{selectedUserIds.length} נבחרו</span>
      <Select value={branchId} onValueChange={setBranchId} disabled={pending}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="בחר סניף" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.nameHe}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={handleAssign} disabled={pending || !branchId}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin ms-2" />
        ) : (
          <MapPin className="h-4 w-4 ms-2" />
        )}
        שיוך לסניף
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone} disabled={pending}>
        ביטול בחירה
      </Button>
    </div>
  );
}
