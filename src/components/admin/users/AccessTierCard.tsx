"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setAccessOverride } from "@/lib/actions/admin-access-override";
import {
  resolveAccessTier,
  type AccessOverride,
} from "@/lib/access/course-access";

interface AccessTierCardProps {
  userId: string;
  arboxPaidTraining: boolean;
  arboxBoughtCourse: boolean;
  accessOverride: AccessOverride;
  arboxUserId: number | null;
  syncedAt: string | null;
}

/**
 * What this trainee can reach, why, and how to overrule it.
 *
 * The two Arbox facts are shown rather than just the verdict, because the
 * support question is never "what tier is this?" but "why is this person
 * restricted?".
 */
export function AccessTierCard({
  userId,
  arboxPaidTraining,
  arboxBoughtCourse,
  accessOverride,
  arboxUserId,
  syncedAt,
}: AccessTierCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const tier = resolveAccessTier({
    arboxPaidTraining,
    arboxBoughtCourse,
    accessOverride,
  });
  const restricted = tier === "course_only";

  const apply = (next: AccessOverride) => {
    startTransition(async () => {
      const result = await setAccessOverride(userId, next);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("ההרשאה עודכנה");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" aria-hidden="true" />
          גישה לתכנים
        </CardTitle>
        <CardDescription>
          {restricted
            ? "רואה את הקורס הדיגיטלי בלבד"
            : "רואה את כל התכנים באפליקציה"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">שילם על אימונים בעבר</dt>
            <dd className={cn("font-medium", arboxPaidTraining && "text-primary")}>
              {arboxPaidTraining ? "כן" : "לא"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">רכש את הקורס הדיגיטלי</dt>
            <dd className={cn("font-medium", arboxBoughtCourse && "text-primary")}>
              {arboxBoughtCourse ? "כן" : "לא"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">מקושר ל-Arbox</dt>
            <dd className="font-medium tabular-nums">
              {arboxUserId ?? "לא מקושר"}
            </dd>
          </div>
        </dl>

        {!arboxUserId && (
          <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
            הפרופיל לא מקושר ל-Arbox, ולכן לא ניתן לסווג אותו אוטומטית. הוא נשאר
            עם גישה מלאה.
          </p>
        )}

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            עקיפה ידנית
          </p>

          {accessOverride ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">
                נקבע ידנית:{" "}
                <strong>
                  {accessOverride === "full" ? "גישה מלאה" : "קורס בלבד"}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => apply(null)}
                disabled={pending}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-muted disabled:opacity-50"
              >
                חזרה לאוטומטי
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => apply("full")}
                disabled={pending || !restricted}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-muted disabled:opacity-40"
              >
                <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                פתח גישה מלאה
              </button>
              <button
                type="button"
                onClick={() => apply("course_only")}
                disabled={pending || restricted}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-muted disabled:opacity-40"
              >
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                הגבל לקורס בלבד
              </button>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            {syncedAt
              ? `סונכרן מ-Arbox ב-${new Date(syncedAt).toLocaleDateString("he-IL")}`
              : "עדיין לא סונכרן מ-Arbox"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
