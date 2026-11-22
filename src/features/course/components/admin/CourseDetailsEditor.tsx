"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CourseCoverUpload } from "./CourseCoverUpload";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import {
  deleteCourse,
  moveCourse,
  updateCourseDetails,
} from "@/features/course/lib/actions/admin-course-structure";

interface CourseDetailsEditorProps {
  courseId: string;
  titleHe: string;
  descriptionHe: string | null;
  coverUrl: string | null;
  /** Only an empty course (no chapters) may be deleted. */
  canDelete: boolean;
}

/** Description, position among courses, and deletion of an empty course. */
export function CourseDetailsEditor({
  courseId,
  titleHe,
  descriptionHe,
  coverUrl,
  canDelete,
}: CourseDetailsEditorProps) {
  const router = useRouter();
  const saved = descriptionHe ?? "";
  const [description, setDescription] = useState(saved);
  const [savePending, startSave] = useTransition();
  const [movePending, startMove] = useTransition();

  const dirty = description.trim() !== saved.trim();

  const handleSave = () => {
    startSave(async () => {
      const result = await updateCourseDetails(courseId, {
        titleHe,
        descriptionHe: description.trim() || null,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("התיאור נשמר");
      router.refresh();
    });
  };

  const handleMove = (direction: "up" | "down") => {
    startMove(async () => {
      const result = await moveCourse(courseId, direction);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <CourseCoverUpload courseId={courseId} coverUrl={coverUrl} />

      <div className="space-y-1.5">
        <Label
          htmlFor="course-description"
          className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
        >
          תיאור הקורס
        </Label>
        <Textarea
          id="course-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={savePending}
          rows={2}
        />
        {dirty && (
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={savePending}
          >
            {savePending ? "שומר..." : "שמור תיאור"}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleMove("up")}
          disabled={movePending}
        >
          <ArrowRight className="h-4 w-4 me-1.5" aria-hidden="true" />
          הזז קדימה
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleMove("down")}
          disabled={movePending}
        >
          <ArrowLeft className="h-4 w-4 me-1.5" aria-hidden="true" />
          הזז אחורה
        </Button>

        {canDelete && (
          <DeleteConfirmDialog
            title="מחיקת הקורס"
            description={`הקורס "${titleHe}" יימחק. אי אפשר לבטל את הפעולה.`}
            confirmLabel="מחק קורס"
            successMessage="הקורס נמחק"
            errorMessage="מחיקת הקורס נכשלה"
            onDelete={() => deleteCourse(courseId)}
            onSuccess={() => {
              router.push("/admin/course");
              router.refresh();
            }}
            trigger={
              <Button type="button" variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 me-1.5" aria-hidden="true" />
                מחק קורס
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
