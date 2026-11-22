"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createChapter } from "@/features/course/lib/actions/admin-course-structure";

interface ChapterCreateFormProps {
  courseId: string;
  /** Called with the new chapter's id once it exists and the tree is reloaded. */
  onCreated?: (chapterId: string) => void;
}

/** "פרק חדש": adds a chapter at the end of the course. */
export function ChapterCreateForm({ courseId, onCreated }: ChapterCreateFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await createChapter(
        courseId,
        title,
        subtitle.trim() || null
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("הפרק נוסף");
      setTitle("");
      setSubtitle("");
      if (result.chapterId) onCreated?.(result.chapterId);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="פרק חדש"
      className="space-y-2 rounded-lg border border-dashed border-border p-3"
    >
      <p className="text-sm font-bold">פרק חדש</p>
      <div className="space-y-1">
        <Label htmlFor="new-chapter-title" className="text-xs">
          שם הפרק
        </Label>
        <Input
          id="new-chapter-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={pending}
          className="h-8"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-chapter-subtitle" className="text-xs">
          כותרת משנה (לא חובה)
        </Label>
        <Input
          id="new-chapter-subtitle"
          value={subtitle}
          onChange={(event) => setSubtitle(event.target.value)}
          disabled={pending}
          className="h-8"
        />
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={pending || title.trim() === ""}
      >
        {pending ? "מוסיף..." : "הוסף פרק"}
      </Button>
    </form>
  );
}
