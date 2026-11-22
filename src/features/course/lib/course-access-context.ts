import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelDateStr } from "@/lib/utils/israel-time";
import {
  effectiveLastGoodSweep,
  type CourseAccessContext,
  type SweepSpan,
} from "./course-access-rule";

type Db = ReturnType<typeof createAdminClient>;

/** The first or the last good sweep day, by `ascending`. Throws on a failed read. */
async function readSweepDay(db: Db, ascending: boolean): Promise<string | null> {
  const { data, error } = await db
    .from("course_access_sweeps")
    .select("swept_on")
    .order("swept_on", { ascending })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.swept_on ?? null;
}

async function readSweepSpan(): Promise<SweepSpan | null> {
  try {
    const db = createAdminClient();
    const [oldest, newest] = await Promise.all([readSweepDay(db, true), readSweepDay(db, false)]);
    return { oldest, newest };
  } catch (error) {
    console.error("getCourseAccessContext failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Today (Israel) and the last good sweep the course rule counts from, read with
 * the service role because course_access_sweeps is server-only. The rule is on
 * only once the oldest good sweep is a week old (`effectiveLastGoodSweep`);
 * until then, and after a failed read, `lastGoodSweepOn` is null and
 * canOpenCourse keeps the old rule. Memoized per request.
 */
export const getCourseAccessContext = cache(async (): Promise<CourseAccessContext> => {
  const today = israelDateStr(new Date());
  return { today, lastGoodSweepOn: effectiveLastGoodSweep(await readSweepSpan(), today) };
});
