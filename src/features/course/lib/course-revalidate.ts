import { revalidatePath } from "next/cache";

/** Drop every cached page that shows course content. Not a server action. */
export function revalidateCourse(): void {
  revalidatePath("/admin/course");
  revalidatePath("/dashboard/courses", "layout");
}
