import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { COURSE_ACCESS_DENIED } from "@/features/course/lib/course-access-rule";
import type { AskParent } from "@/features/course/lib/load-course";
import {
  PurchaseRequestButton,
  REQUEST_LABELS,
} from "@/features/plans/components/PurchaseRequestButton";

interface CourseLockedNoticeProps {
  titleHe: string;
  descriptionHe: string | null;
  /** Show the "ask the parent to buy" button. */
  askParent: AskParent | null;
}

/**
 * A course the viewer may not open yet: the same header look as CourseCover,
 * then the refusal and, where a purchase is possible, the buy request button.
 */
export function CourseLockedNotice({
  titleHe,
  descriptionHe,
  askParent,
}: CourseLockedNoticeProps) {
  return (
    <div
      className={cn(
        "relative mb-6 overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-forest/15 via-forest/5 to-background",
        "border border-primary/20 p-6 sm:p-10"
      )}
    >
      <div className="relative space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Garden of Eden
        </p>
        <h1 className="text-2xl font-black leading-tight sm:text-4xl">{titleHe}</h1>
        {descriptionHe && (
          <p className="max-w-prose text-sm text-muted-foreground">{descriptionHe}</p>
        )}
        <div
          className="h-0.5 w-14 rounded-full bg-gradient-to-l from-gold to-primary"
          aria-hidden="true"
        />
        <p className="flex items-center gap-2 text-sm font-medium">
          <Lock className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {COURSE_ACCESS_DENIED}
        </p>
        {askParent && (
          <div className="pt-2">
            <PurchaseRequestButton label={REQUEST_LABELS[askParent]} />
          </div>
        )}
      </div>
    </div>
  );
}
