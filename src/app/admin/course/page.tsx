import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { listCourseAdminTree, listCourses } from "@/features/course/lib/actions/admin-course";
import { CourseSwitcher } from "@/features/course/components/admin/CourseSwitcher";
import { CourseNotice } from "@/features/course/components/CourseNotice";
import { DIGITAL_COURSE_SLUG } from "@/features/course/lib/course-slugs";
import { CourseAdminClient } from "@/features/course/components/admin/CourseAdminClient";

export const metadata: Metadata = {
  title: "קורסים | Garden of Eden",
};

export const dynamic = "force-dynamic";

interface AdminCoursePageProps {
  searchParams: Promise<{ course?: string }>;
}

export default async function AdminCoursePage({ searchParams }: AdminCoursePageProps) {
  const slug = (await searchParams).course ?? DIGITAL_COURSE_SLUG;
  // Trainers reach /admin/* too, and they are authorised for the progress
  // report. The role has to be known here so a trainer is not shown the CMS's
  // "no course yet, run the seed script" state, which is both wrong and useless
  // advice for them.
  const { profile } = await verifyAdminOrTrainer();
  const isAdmin = profile?.role === "admin";
  const [course, courses] = await Promise.all([
    isAdmin ? listCourseAdminTree(slug) : Promise.resolve(null),
    listCourses(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 flex items-center gap-2 text-3xl font-bold">
            <GraduationCap className="h-7 w-7" aria-hidden="true" />
            קורסים
          </h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? "ניהול פרקים ושיעורים, שמות ופרסום"
              : "מעקב אחר התקדמות המתאמנים בקורס"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/course/progress?course=${slug}`}>
            <BarChart3 className="h-4 w-4 ms-2" />
            התקדמות מתאמנים
          </Link>
        </Button>
      </div>

      <CourseSwitcher courses={courses} current={slug} basePath="/admin/course" />

      {!isAdmin ? (
        <CourseNotice message="עריכת תכני הקורס פתוחה למנהלים בלבד. אפשר לצפות בהתקדמות המתאמנים בכפתור שלמעלה." />
      ) : course ? (
        <CourseAdminClient key={course.id} course={course} />
      ) : (
        <CourseNotice message="עדיין לא נוצר קורס. הרץ את סקריפט הזריעה כדי לייבא את הפרקים והשיעורים." />
      )}
    </div>
  );
}
