"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlaysUpMark } from "@/components/admin/schedule/PlaysUpMark";
import { Switch } from "@/components/ui/switch";
import { setPlaysUp } from "@/lib/actions/admin-plays-up";

interface PlaysUpToggleProps {
  userId: string;
  playsUp: boolean;
}

/**
 * The A mark, under the age group: staff cleared this trainee to train with
 * an older birth year, and the calendar shows an "A" by his name. Saves at
 * once and is not part of the form's save button.
 */
export function PlaysUpToggle({ userId, playsUp }: PlaysUpToggleProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    startTransition(async () => {
      const result = await setPlaysUp(userId, next);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? "סומן A: יכול לעלות שנתון" : "סימון A הוסר");
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-3 pt-2" aria-busy={pending}>
      <Switch
        id={`plays-up-${userId}`}
        checked={playsUp}
        onCheckedChange={toggle}
        disabled={pending}
      />
      <label htmlFor={`plays-up-${userId}`} className="flex items-center gap-2 text-sm font-medium">
        <PlaysUpMark />
        יכול לעלות שנתון
      </label>
    </div>
  );
}
