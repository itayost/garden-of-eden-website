import type { Metadata } from "next";
import { CourseHomePage } from "@/features/course/components/trainee/CourseHomePage";
import { TACTICAL_COURSE_SLUG } from "@/features/course/lib/course-slugs";

export const metadata: Metadata = {
  title: "הקורס הטקטי | Garden of Eden",
};

// Depends on the signed-in trainee's own progress.
export const dynamic = "force-dynamic";

export default function Page() {
  return <CourseHomePage slug={TACTICAL_COURSE_SLUG} basePath="/dashboard/tactical-course" />;
}
