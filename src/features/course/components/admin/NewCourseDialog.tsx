"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCourse } from "@/features/course/lib/actions/admin-course-structure";

/** "קורס חדש": names a course and opens it once it exists. */
export function NewCourseDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setTitleError(null);
    startTransition(async () => {
      const result = await createCourse(title, description.trim() || null);
      if ("error" in result) {
        setTitleError(result.fieldErrors?.titleHe?.[0] ?? null);
        toast.error(result.error);
        return;
      }
      toast.success("הקורס נוצר");
      setOpen(false);
      setTitle("");
      setDescription("");
      router.push(`/admin/course?course=${result.slug}`);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus className="h-4 w-4 me-2" aria-hidden="true" />
          קורס חדש
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>קורס חדש</DialogTitle>
            <DialogDescription>
              הקורס נוצר כטיוטה. אפשר לפרסם אותו אחרי שיהיה בו שיעור מפורסם.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="new-course-title">שם הקורס</Label>
            <Input
              id="new-course-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={pending}
              required
              aria-invalid={titleError !== null}
            />
            {titleError && (
              <p className="text-xs text-destructive">{titleError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-course-description">תיאור (לא חובה)</Label>
            <Textarea
              id="new-course-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={pending}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || title.trim() === ""}>
              {pending ? "יוצר..." : "צור קורס"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
