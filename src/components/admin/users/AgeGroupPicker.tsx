"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setAgeGroupOverride } from "@/lib/actions/admin-age-group-override";
import {
  isAgeGroupOverrideActive,
  resolveAgeGroup,
  type AgeGroupProfile,
} from "@/lib/age-group-override";
import { AGE_GROUPS, getAgeGroup } from "@/types/assessment";

interface AgeGroupPickerProps {
  userId: string;
  profile: AgeGroupProfile;
  /** The birthdate input holds an unsaved edit; the end date needs the saved one. */
  isBirthdateEdited: boolean;
}

/** YYYY-MM-DD as DD.MM.YYYY. */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * The trainee's age group, under the birthdate it comes from. Picking another
 * group moves him there until his next birthday; it saves at once and is not
 * part of the form's save button.
 */
export function AgeGroupPicker({ userId, profile, isBirthdateEdited }: AgeGroupPickerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const byAge = getAgeGroup(profile.birthdate);
  const current = resolveAgeGroup(profile);
  const isManual = isAgeGroupOverrideActive(profile);
  const isLocked = !profile.birthdate || isBirthdateEdited;

  const apply = (groupId: string | null) => {
    startTransition(async () => {
      const result = await setAgeGroupOverride(userId, groupId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.until ? `קבוצת הגיל עודכנה עד ${formatDate(result.until)}` : "חזר לקבוצה לפי גיל"
      );
      router.refresh();
    });
  };

  const pick = (groupId: string) => {
    if (groupId === current?.id) return;
    apply(groupId === byAge?.id ? null : groupId);
  };

  return (
    <div className="space-y-1.5 pt-1" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span id={`age-group-${userId}`} className="text-sm font-medium">
          קבוצת גיל
        </span>
        <div
          role="group"
          aria-labelledby={`age-group-${userId}`}
          className={cn(
            "inline-flex rounded-lg border border-border bg-muted/50 p-0.5 transition-opacity",
            pending && "opacity-60"
          )}
        >
          {AGE_GROUPS.map((group) => {
            const isCurrent = group.id === current?.id;
            const isAgeHome = isManual && group.id === byAge?.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => pick(group.id)}
                disabled={isLocked || pending}
                aria-pressed={isCurrent}
                title={isAgeHome ? `${group.labelHe} (לפי גיל)` : group.labelHe}
                className={cn(
                  "h-8 min-w-11 rounded-md border px-2.5 text-xs font-bold tabular-nums transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  "disabled:cursor-not-allowed",
                  isCurrent
                    ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                    : "border-transparent text-muted-foreground enabled:hover:bg-background enabled:hover:text-foreground",
                  isAgeHome && "border-dashed border-muted-foreground/60 text-foreground",
                  isLocked && !isCurrent && "opacity-50"
                )}
              >
                {group.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {!profile.birthdate ? (
          "יש להזין ולשמור תאריך לידה כדי לקבוע קבוצת גיל."
        ) : isBirthdateEdited ? (
          "שמרו את תאריך הלידה החדש, ואז אפשר לשנות קבוצה."
        ) : isManual && byAge ? (
          <>
            נקבע ידנית עד {formatDate(profile.age_group_override_until!)}. לפי גיל: {byAge.label}.{" "}
            <button
              type="button"
              onClick={() => apply(null)}
              disabled={pending}
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary disabled:opacity-50"
            >
              חזרה לפי גיל
            </button>
          </>
        ) : (
          "לפי תאריך הלידה. בחירת קבוצה אחרת מעבירה אותו אליה עד יום ההולדת הבא."
        )}
      </p>
    </div>
  );
}
