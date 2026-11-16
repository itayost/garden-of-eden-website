"use client";

import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveAllAction } from "../../lib/actions/approve";
import { ConfirmActionDialog } from "./ConfirmActionDialog";

interface ApproveAllButtonProps {
  weekStart: string;
  /** The branch in view; the action approves only its rows. */
  branchId?: string;
  /** Pending reports in view that have a text. */
  count: number;
}

/**
 * "אשר את כל הממתינים": approves the pending reports in view. Held reports
 * are never included; a Hold always needs a person to open the report.
 */
export function ApproveAllButton({ weekStart, branchId, count }: ApproveAllButtonProps) {
  const router = useRouter();

  async function approveAll(): Promise<boolean> {
    const result = await approveAllAction({ weekStart, filterBranchId: branchId });
    if ("error" in result) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.count === 1 ? "דוח אחד אושר" : `${result.count} דוחות אושרו`);
    if (result.held > 0) {
      toast.warning(
        result.held === 1
          ? "דוח אחד עוכב: נוספו עליו נתונים שמחייבים בדיקה"
          : `${result.held} דוחות עוכבו: נוספו עליהם נתונים שמחייבים בדיקה`,
      );
    }
    router.refresh();
    return true;
  }

  return (
    <ConfirmActionDialog
      title="לאשר את כל הממתינים?"
      description={`${count === 1 ? "דוח אחד ממתין" : `${count} דוחות ממתינים`} לאישור בתצוגה הזו. דוחות מעוכבים לא יאושרו. הדוחות המאושרים יישלחו בחלון השליחה הבא.`}
      confirmLabel="אישור הכל"
      busyLabel="מאשר..."
      onConfirm={approveAll}
      trigger={
        <Button type="button" disabled={count === 0} className="w-full sm:w-auto">
          <CheckCheck aria-hidden="true" />
          אשר את כל הממתינים ({count})
        </Button>
      }
    />
  );
}
