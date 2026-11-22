import type { Metadata } from "next";
import { CourseList } from "@/features/course/components/trainee/CourseList";
import { loadCourseList } from "@/features/course/lib/load-course-list";

export const metadata: Metadata = {
  title: "קורסים | Garden of Eden",
};

// Depends on the signed-in trainee's own progress and access.
export const dynamic = "force-dynamic";

export default async function Page() {
  const courses = await loadCourseList();
  return <CourseList courses={courses} />;
}
