"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listExercises, listSubCategories } from "@/features/workouts/lib/actions";
import { MAIN_CATEGORIES } from "@/features/workouts/lib/types";
import type { WorkoutExercise } from "@/features/workouts/lib/types";

const PAGE_SIZE = 20;

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onAdd: (exercise: WorkoutExercise) => void;
}

export function ExercisePicker({ open, onClose, onAdd }: ExercisePickerProps) {
  const [mainCategory, setMainCategory] = useState<string>("");
  const [subCategory, setSubCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loadingExercises, startLoadExercises] = useTransition();
  const [loadingSubCats, startLoadSubCats] = useTransition();

  // Track previous open state so we can react when dialog first opens
  const prevOpenRef = useRef(false);

  // Load sub-categories whenever mainCategory or open changes
  useEffect(() => {
    if (!open) return;
    startLoadSubCats(async () => {
      const cats = await listSubCategories(mainCategory || undefined);
      setSubCategories(cats);
    });
  }, [mainCategory, open]);

  // Load exercises whenever filters, page, or open change
  useEffect(() => {
    if (!open) return;
    startLoadExercises(async () => {
      const result = await listExercises(
        {
          mainCategory: mainCategory || undefined,
          subCategory: subCategory || undefined,
          search: search || undefined,
        },
        page
      );
      setExercises(result.rows);
      setTotal(result.total);
    });
  }, [mainCategory, subCategory, search, page, open]);

  // When the dialog transitions from closed to open, reset state via a
  // key-based remount pattern applied to internal controlled values.
  // We store the "open generation" as a key for child inputs.
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      prevOpenRef.current = true;
    } else if (!open) {
      prevOpenRef.current = false;
    }
  }, [open]);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose();
      // Reset after close animation frame
      requestAnimationFrame(() => {
        setMainCategory("");
        setSubCategory("");
        setSearch("");
        setPage(0);
        setSubCategories([]);
        setExercises([]);
        setTotal(0);
      });
    }
  };

  const handleMainCategoryChange = (v: string) => {
    setMainCategory(v === "__all__" ? "" : v);
    setSubCategory("");
    setPage(0);
  };

  const handleSubCategoryChange = (v: string) => {
    setSubCategory(v === "__all__" ? "" : v);
    setPage(0);
  };

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(0);
  };

  const handleAdd = (exercise: WorkoutExercise) => {
    onAdd(exercise);
    onClose();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle>בחר תרגיל</DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="px-4 pb-3 border-b space-y-2">
          <Input
            placeholder="חפש שם תרגיל..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            <Select
              value={mainCategory || "__all__"}
              onValueChange={handleMainCategoryChange}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="כל הקטגוריות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">כל הקטגוריות</SelectItem>
                {MAIN_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {subCategories.length > 0 && (
              <Select
                value={subCategory || "__all__"}
                onValueChange={handleSubCategoryChange}
                disabled={loadingSubCats}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="תת-קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">הכל</SelectItem>
                  {subCategories.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loadingExercises ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : exercises.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              לא נמצאו תרגילים
            </div>
          ) : (
            <ul className="divide-y">
              {exercises.map((exercise) => (
                <li
                  key={exercise.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {exercise.nameHe ?? exercise.nameEn ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {exercise.mainCategory}
                      {exercise.subCategory ? ` / ${exercise.subCategory}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAdd(exercise)}
                    aria-label={`הוסף ${exercise.nameHe ?? exercise.nameEn ?? ""}`}
                  >
                    <Plus className="h-3.5 w-3.5 ms-1" />
                    הוסף
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t p-3 flex items-center justify-between gap-2 text-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loadingExercises}
            >
              הקודם
            </Button>
            <span className="text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loadingExercises}
            >
              הבא
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
