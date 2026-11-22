import { revalidatePath } from "next/cache";

// The old trainee routes stay until a later task removes them.
const LEGACY_TRAINEE_PATHS = ["/dashboard/course", "/dashboard/tactical-course"];

/** Drop every cached page that shows course content. Not a server action. */
export function revalidateCourse(): void {
  revalidatePath("/admin/course");
  revalidatePath("/dashboard/courses", "layout");
  for (const path of LEGACY_TRAINEE_PATHS) revalidatePath(path);
}
