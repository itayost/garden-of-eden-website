"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SheetDialogContent } from "@/components/ui/sheet-dialog";
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

/**
 * Typing fires a server action that also resolves matching equipment names, so
 * keystrokes are debounced. It matters more here than it used to: the dialog
 * now stays open across an entire selection pass instead of closing after one
 * add.
 */
const SEARCH_DEBOUNCE_MS = 300;

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  /** Called once with everything selected, when the trainer confirms. */
  onAdd: (exercises: WorkoutExercise[]) => void;
  /**
   * Rendered as "כבר באימון" and non-selectable. Omit to allow duplicates —
   * a program grid legitimately repeats an exercise, a session does not.
   */
  alreadyAddedIds?: string[];
}

function exerciseLabel(exercise: WorkoutExercise): string {
  return exercise.nameHe ?? exercise.nameEn ?? "—";
}

/**
 * Picks any number of exercises from the library in one pass.
 *
 * Selection holds whole `WorkoutExercise` objects rather than ids: the caller
 * seeds a row's targets from `equipmentProfile` and the `default*` fields,
 * which exist only on the fetched row. Ids alone would force a refetch of
 * everything selected.
 *
 * It also means selection survives search, filter and page changes — the list
 * is server-paginated, so a selected exercise scrolls out of the result set
 * the moment the trainer searches for the next one.
 */
export function ExercisePicker({
  open,
  onClose,
  onAdd,
  alreadyAddedIds,
}: ExercisePickerProps) {
  const [mainCategory, setMainCategory] = useState<string>("");
  const [subCategory, setSubCategory] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [selected, setSelected] = useState<WorkoutExercise[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loadingExercises, startLoadExercises] = useTransition();
  const [loadingSubCats, startLoadSubCats] = useTransition();

  const selectedIds = useMemo(
    () => new Set(selected.map((exercise) => exercise.id)),
    [selected],
  );
  const addedIds = useMemo(
    () => new Set(alreadyAddedIds ?? []),
    [alreadyAddedIds],
  );

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

  const applySearch = useDebouncedCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, SEARCH_DEBOUNCE_MS);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose();
      // Reset after close animation frame
      requestAnimationFrame(() => {
        setMainCategory("");
        setSubCategory("");
        setSearchInput("");
        setSearch("");
        setPage(0);
        setSubCategories([]);
        setExercises([]);
        setSelected([]);
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
    setSearchInput(v);
    applySearch(v);
  };

  const toggle = (exercise: WorkoutExercise) => {
    setSelected((prev) =>
      prev.some((item) => item.id === exercise.id)
        ? prev.filter((item) => item.id !== exercise.id)
        : [...prev, exercise],
    );
  };

  const remove = (id: string) => {
    setSelected((prev) => prev.filter((item) => item.id !== id));
  };

  // "Everything on this page" means everything selectable on it — rows already
  // in the session are not silently re-added.
  const selectablePage = exercises.filter((exercise) => !addedIds.has(exercise.id));
  const allPageSelected =
    selectablePage.length > 0 &&
    selectablePage.every((exercise) => selectedIds.has(exercise.id));

  const togglePage = () => {
    setSelected((prev) => {
      if (allPageSelected) {
        const pageIds = new Set(selectablePage.map((exercise) => exercise.id));
        return prev.filter((item) => !pageIds.has(item.id));
      }
      const known = new Set(prev.map((item) => item.id));
      return [...prev, ...selectablePage.filter((exercise) => !known.has(exercise.id))];
    });
  };

  const handleAdd = () => {
    if (selected.length === 0) return;
    onAdd(selected);
    onClose();
    requestAnimationFrame(() => setSelected([]));
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <SheetDialogContent dir="rtl" className="sm:max-w-2xl">
        <DialogHeader className="px-4 pt-4 pb-3 text-start sm:px-6 sm:pt-6">
          <DialogTitle>בחר תרגילים</DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-2 border-b px-4 pb-3 sm:px-6">
          <Input
            placeholder="חפש שם תרגיל..."
            value={searchInput}
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
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingExercises ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : exercises.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              לא נמצאו תרגילים
            </div>
          ) : (
            <>
              {selectablePage.length > 0 && (
                <div className="flex justify-start border-b px-4 py-1.5 sm:px-6">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={togglePage}
                  >
                    {allPageSelected ? "ביטול הבחירה בעמוד" : "בחירת הכל בעמוד"}
                  </Button>
                </div>
              )}
              <ul className="divide-y">
                {exercises.map((exercise) => {
                  const isAdded = addedIds.has(exercise.id);
                  const isSelected = selectedIds.has(exercise.id);
                  return (
                    <li key={exercise.id}>
                      <label
                        className={[
                          "flex items-center gap-3 px-4 py-2.5 sm:px-6",
                          isAdded
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer hover:bg-muted/40",
                          isSelected && !isAdded ? "bg-forest/5" : "",
                        ].join(" ")}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={isAdded}
                          onCheckedChange={() => toggle(exercise)}
                          aria-label={exerciseLabel(exercise)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {exerciseLabel(exercise)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {exercise.mainCategory}
                            {exercise.subCategory ? ` / ${exercise.subCategory}` : ""}
                          </p>
                        </div>
                        {isAdded && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            כבר באימון
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t p-3 text-sm">
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

        {/* Selection tray. Always rendered so the count never shifts the layout
            as the trainer picks. */}
        <div className="space-y-2 border-t bg-background px-4 py-3 sm:px-6">
          {selected.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {selected.map((exercise) => (
                <Badge
                  key={exercise.id}
                  variant="secondary"
                  className="shrink-0 gap-1 ps-2 pe-1"
                >
                  <span className="max-w-40 truncate">{exerciseLabel(exercise)}</span>
                  <button
                    type="button"
                    onClick={() => remove(exercise.id)}
                    className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label={`הסרת ${exerciseLabel(exercise)} מהבחירה`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <p
              className="text-sm text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              {selected.length > 0 ? `נבחרו ${selected.length}` : "לא נבחרו תרגילים"}
            </p>
            <div className="flex gap-2">
              {selected.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                  ניקוי
                </Button>
              )}
              <Button size="sm" onClick={handleAdd} disabled={selected.length === 0}>
                הוספה{selected.length > 0 ? ` (${selected.length})` : ""}
              </Button>
            </div>
          </div>
        </div>
      </SheetDialogContent>
    </Dialog>
  );
}
