"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdmin } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import {
  cleanOptionalText,
  courseSlugFor,
  deleteChapterProblem,
  deleteCourseProblem,
  positionalSlug,
  validateTitle,
} from "../course-admin-rules";
import { revalidateCourse } from "../course-revalidate";
import type { CourseActionResult } from "./admin-course";

const MAX_DESCRIPTION = 500;
const MAX_SUBTITLE = 200;
const SAVE_FAILED = "שמירה נכשלה";
const DELETE_FAILED = "המחיקה נכשלה";

interface OrderedRow {
  id: string;
  order_index: number;
}

function nextIndexAfter(rows: readonly { order_index: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.order_index), -1) + 1;
}

/** Create a course: unpublished, ordered last, with a generated unique slug. */
export async function createCourse(
  titleHe: string,
  descriptionHe: string | null
): Promise<CourseActionResult & { slug?: string }> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const titleError = validateTitle(titleHe);
  if (titleError) return { error: titleError };
  const description = cleanOptionalText(descriptionHe, MAX_DESCRIPTION);
  if ("error" in description) return { error: description.error };

  const db = createAdminClient();
  const { data, error: readError } = await typedFrom(db, "courses").select(
    "slug, order_index"
  );
  if (readError) {
    console.error("createCourse read courses failed:", readError);
    return { error: SAVE_FAILED };
  }

  const existing = (data ?? []) as { slug: string; order_index: number }[];
  const slug = courseSlugFor(
    titleHe,
    new Set(existing.map((row) => row.slug))
  );

  const { error } = await typedFrom(db, "courses").insert({
    slug,
    title_he: titleHe.trim(),
    description_he: description.value,
    is_published: false,
    needs_title: false,
    order_index: nextIndexAfter(existing),
  });
  if (error) {
    console.error("createCourse failed:", error);
    return { error: SAVE_FAILED };
  }

  revalidateCourse();
  return { success: true, slug };
}

/** Change a course's title and description. */
export async function updateCourseDetails(
  courseId: string,
  details: { titleHe: string; descriptionHe: string | null }
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(courseId)) return { error: "מזהה קורס לא תקין" };

  const titleError = validateTitle(details.titleHe);
  if (titleError) return { error: titleError };
  const description = cleanOptionalText(details.descriptionHe, MAX_DESCRIPTION);
  if ("error" in description) return { error: description.error };

  const db = createAdminClient();
  const { data, error } = await typedFrom(db, "courses")
    .update({
      title_he: details.titleHe.trim(),
      description_he: description.value,
      needs_title: false,
    })
    .eq("id", courseId)
    .select("id");
  if (error) {
    console.error("updateCourseDetails failed:", error);
    return { error: SAVE_FAILED };
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { error: "הקורס לא נמצא" };
  }

  revalidateCourse();
  return { success: true };
}

/**
 * Swap a course with its neighbour in `direction`. PostgREST has no
 * transaction, so this is two updates; ties on order_index fall back to id so
 * the neighbour is stable.
 */
export async function moveCourse(
  courseId: string,
  direction: "up" | "down"
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(courseId)) return { error: "מזהה קורס לא תקין" };
  if (direction !== "up" && direction !== "down") {
    return { error: "כיוון לא תקין" };
  }

  const db = createAdminClient();
  const { data, error: readError } = await typedFrom(db, "courses")
    .select("id, order_index")
    .order("order_index", { ascending: true })
    .order("id", { ascending: true });
  if (readError) {
    console.error("moveCourse read failed:", readError);
    return { error: SAVE_FAILED };
  }

  const rows = (data ?? []) as OrderedRow[];
  const at = rows.findIndex((row) => row.id === courseId);
  if (at === -1) return { error: "הקורס לא נמצא" };

  const neighbour = rows[direction === "up" ? at - 1 : at + 1];
  if (!neighbour) return { success: true };

  const current = rows[at];
  // Equal indexes would make the swap a no-op; give the pair distinct values.
  const currentNext = neighbour.order_index;
  const neighbourNext =
    current.order_index === neighbour.order_index
      ? direction === "up"
        ? current.order_index + 1
        : current.order_index - 1
      : current.order_index;

  const first = await typedFrom(db, "courses")
    .update({ order_index: currentNext })
    .eq("id", current.id);
  const second = first.error
    ? first
    : await typedFrom(db, "courses")
        .update({ order_index: neighbourNext })
        .eq("id", neighbour.id);
  if (first.error || second.error) {
    console.error("moveCourse failed:", first.error ?? second.error);
    return { error: SAVE_FAILED };
  }

  revalidateCourse();
  return { success: true };
}

/** Delete a course, only while it has no chapters. */
export async function deleteCourse(
  courseId: string
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(courseId)) return { error: "מזהה קורס לא תקין" };

  const db = createAdminClient();
  const { count, error: countError } = await typedFrom(db, "course_chapters")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  if (countError) {
    console.error("deleteCourse count chapters failed:", countError);
    return { error: DELETE_FAILED };
  }
  const problem = deleteCourseProblem(count ?? 0);
  if (problem) return { error: problem };

  const { data, error } = await typedFrom(db, "courses")
    .delete()
    .eq("id", courseId)
    .select("id");
  if (error) {
    console.error("deleteCourse failed:", error);
    return { error: DELETE_FAILED };
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { error: "הקורס לא נמצא" };
  }

  revalidateCourse();
  return { success: true };
}

/** Add a chapter at the end of a course. */
export async function createChapter(
  courseId: string,
  titleHe: string,
  subtitleHe: string | null
): Promise<CourseActionResult & { chapterId?: string }> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(courseId)) return { error: "מזהה קורס לא תקין" };

  const titleError = validateTitle(titleHe);
  if (titleError) return { error: titleError };
  const subtitle = cleanOptionalText(subtitleHe, MAX_SUBTITLE);
  if ("error" in subtitle) return { error: subtitle.error };

  const db = createAdminClient();
  const { data, error: readError } = await typedFrom(db, "course_chapters")
    .select("slug, order_index")
    .eq("course_id", courseId);
  if (readError) {
    console.error("createChapter read siblings failed:", readError);
    return { error: SAVE_FAILED };
  }

  const existing = (data ?? []) as { slug: string; order_index: number }[];
  const nextIndex = nextIndexAfter(existing);

  // Unique within the course; nudge past a collision instead of failing.
  const taken = new Set(existing.map((row) => row.slug));
  const base = positionalSlug(titleHe, nextIndex, "chapter");
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

  const { data: created, error } = await typedFrom(db, "course_chapters")
    .insert({
      course_id: courseId,
      slug,
      title_he: titleHe.trim(),
      subtitle_he: subtitle.value,
      needs_title: false,
      order_index: nextIndex,
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("createChapter failed:", error);
    return { error: SAVE_FAILED };
  }

  revalidateCourse();
  return { success: true, chapterId: created.id };
}

/** Delete a chapter, only while it has no lessons. */
export async function deleteChapter(
  chapterId: string
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(chapterId)) return { error: "מזהה פרק לא תקין" };

  const db = createAdminClient();
  const { count, error: countError } = await typedFrom(db, "course_lessons")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId);
  if (countError) {
    console.error("deleteChapter count lessons failed:", countError);
    return { error: DELETE_FAILED };
  }
  const problem = deleteChapterProblem(count ?? 0);
  if (problem) return { error: problem };

  const { data, error } = await typedFrom(db, "course_chapters")
    .delete()
    .eq("id", chapterId)
    .select("id");
  if (error) {
    console.error("deleteChapter failed:", error);
    return { error: DELETE_FAILED };
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { error: "הפרק לא נמצא" };
  }

  revalidateCourse();
  return { success: true };
}
