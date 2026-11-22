import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { canAskParentToBuy } from "@/features/plans/lib/can-ask-parent";
import { loadPlanQueues } from "@/features/plans/lib/queries";
import { getCourseUserId, getCourseViewer, getMyLessonProgress, getPublishedCourse } from "./actions/course-read";
import { canOpenCourse } from "./course-access-rule";
import { getCourseAccessContext } from "./course-access-context";
import type { CourseWithChapters, LessonProgressMap } from "./types";

/**
 * Everything a course page needs, and whether this viewer may open it. Shared
 * by the course home and the lesson page so the fetch and the gate stay one.
 */
export async function loadCourseForViewer(slug: string): Promise<{
  course: CourseWithChapters | null;
  progress: LessonProgressMap;
  canOpen: boolean;
  /** Which "ask the parent" button a locked trainee gets, or null for none. */
  askParent: AskParent | null;
}> {
  const [course, progress, viewer, ctx] = await Promise.all([
    getPublishedCourse(slug),
    getMyLessonProgress(),
    getCourseViewer(),
    getCourseAccessContext(),
  ]);
  const canOpen =
    course !== null &&
    canOpenCourse({ slug: course.slug, activeOnly: course.activeOnly }, viewer, ctx);
  const askParent = course !== null && !canOpen && viewer.role === "trainee" ? await askParentOrNull(ctx.today) : null;
  return { course, progress, canOpen, askParent };
}

export type AskParent = "buy" | "renew";

/**
 * Whether a locked trainee may ask the parent to buy or renew, chosen as the
 * dashboard does: renew when the trainee has a Plan queue, buy when not. The
 * button is a nicety: a failed lookup hides it and never breaks the page.
 */
async function askParentOrNull(today: string): Promise<AskParent | null> {
  try {
    const userId = await getCourseUserId();
    if (!userId) return null;
    const db = createAdminClient();
    const [canAsk, queues] = await Promise.all([
      canAskParentToBuy(db, userId),
      loadPlanQueues(db, [userId], today),
    ]);
    if (!canAsk) return null;
    return queues.has(userId) ? "renew" : "buy";
  } catch (error) {
    console.error("canAskParentToBuy failed:", error);
    return null;
  }
}
