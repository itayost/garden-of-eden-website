"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setAgeGroupOverride } from "@/lib/actions/admin-age-group-override";
import {
  isAgeGroupOverrideActive,
  resolveAgeGroup,
  type AgeGroupProfile,
} from "@/lib/age-group-override";
import { AGE_GROUPS, getAgeGroup } from "@/types/assessment";

interface AgeGroupCardProps {
  userId: string;
  profile: AgeGroupProfile;
}

/** YYYY-MM-DD as DD.MM.YYYY. */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * The group this trainee is ranked and rated in, and a way to move him to the
 * group he actually trains with until his next birthday.
 */
export function AgeGroupCard({ userId, profile }: AgeGroupCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const byAge = getAgeGroup(profile.birthdate);
  const current = resolveAgeGroup(profile);
  const isManual = isAgeGroupOverrideActive(profile);

  const apply = (next: string | null) => {
    startTransition(async () => {
      const result = await setAgeGroupOverride(userId, next);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" aria-hidden="true" />
          קבוצת גיל
        </CardTitle>
        <CardDescription>
          {current ? `הדירוג והכרטיס מחושבים מול ${current.label}` : "אין קבוצת גיל"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">לפי תאריך לידה</dt>
            <dd className="font-medium">{byAge?.label ?? "אין תאריך לידה"}</dd>
          </div>
          {isManual && current && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">נקבע ידנית</dt>
              <dd className="font-medium text-primary">
                {current.label} עד {formatDate(profile.age_group_override_until!)}
              </dd>
            </div>
          )}
        </dl>

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            מתאמן עם קבוצה אחרת
          </p>

          {!profile.birthdate ? (
            <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
              יש להזין תאריך לידה קודם. הקבוצה הידנית נמשכת עד יום ההולדת הבא.
            </p>
          ) : isManual ? (
            <button
              type="button"
              onClick={() => apply(null)}
              disabled={pending}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-muted disabled:opacity-50"
            >
              חזרה לקבוצה לפי גיל
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {AGE_GROUPS.filter((group) => group.id !== byAge?.id).map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => apply(group.id)}
                  disabled={pending}
                  title={group.labelHe}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-muted disabled:opacity-40"
                >
                  {group.label}
                </button>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            משנה את הדירוגים, את הכרטיס ואת ההשוואה לקבוצה. חוזר לקבוצה לפי גיל ביום ההולדת הבא.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
