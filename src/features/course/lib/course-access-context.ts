import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelDateStr } from "@/lib/utils/israel-time";
import type { CourseAccessContext } from "./course-access-rule";

/**
 * Today (Israel) and the day of the newest sweep, read with the service role
 * because course_access_sweeps is server-only. A failed read returns no sweep,
 * which makes canOpenCourse fall back to the old rule. Memoized per request.
 */
export const getCourseAccessContext = cache(async (): Promise<CourseAccessContext> => {
  const today = israelDateStr(new Date());
  const { data, error } = await createAdminClient()
    .from("course_access_sweeps")
    .select("swept_on")
    .order("swept_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getCourseAccessContext failed:", error);
    return { today, lastGoodSweepOn: null };
  }
  return { today, lastGoodSweepOn: data?.swept_on ?? null };
});
