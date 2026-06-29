"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategory,
  createParameter,
} from "@/features/development-book/lib/actions/admin-book-categories";
import type {
  AdminBookCategory,
  CategoryInput,
} from "@/features/development-book/lib/actions/admin-book-categories";

// ---------------------------------------------------------------------------
// Add / Edit category dialog
// ---------------------------------------------------------------------------

interface CategoryDialogProps {
  open: boolean;
  category?: AdminBookCategory;
  onClose: () => void;
  onSaved: () => void;
}

function CategoryDialog({ open, category, onClose, onSaved }: CategoryDialogProps) {
  const [pending, startTransition] = useTransition();
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [nameHe, setNameHe] = useState(category?.nameHe ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");

  const isEdit = Boolean(category);

  const handleSave = () => {
    const input: CategoryInput = {
      slug: slug.trim(),
      name_he: nameHe.trim(),
      icon: icon.trim() || undefined,
    };

    startTransition(async () => {
      const result = isEdit && category
        ? await updateCategory(category.id, input)
        : await createCategory(input);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "קטגוריה עודכנה" : "קטגוריה נוצרה");
      onSaved();
      onClose();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת קטגוריה" : "קטגוריה חדשה"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="cat-name">שם (עברית)</Label>
            <Input
              id="cat-name"
              value={nameHe}
              onChange={(e) => setNameHe(e.target.value)}
              placeholder="למשל: ניהול כדור"
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cat-slug">מזהה (slug)</Label>
            <Input
              id="cat-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="ball-control"
              dir="ltr"
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cat-icon">אייקון (אופציונלי)</Label>
            <Input
              id="cat-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="soccer-ball"
              disabled={pending}
            />
          </div>
        </div>
        <DialogFooter className="flex-row-reverse gap-2">
          <Button onClick={handleSave} disabled={pending || !slug || !nameHe}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin ms-2" /> : null}
            שמור
          </Button>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AddParameterButton — creates stub parameter and navigates to its editor
// ---------------------------------------------------------------------------

interface AddParameterButtonProps {
  categoryId: string;
}

function AddParameterButton({ categoryId }: AddParameterButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleAdd = () => {
    startTransition(async () => {
      const result = await createParameter(categoryId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.parameterId) {
        router.push(`/admin/book/parameters/${result.parameterId}`);
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleAdd}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin ms-1" />
      ) : (
        <Plus className="h-3.5 w-3.5 ms-1" />
      )}
      הוסף פרמטר
    </Button>
  );
}

// ---------------------------------------------------------------------------
// CategoryActions — per-row reorder + edit + delete controls
// ---------------------------------------------------------------------------

interface CategoryActionsProps {
  category: AdminBookCategory;
  isFirst: boolean;
  isLast: boolean;
  onRefresh: () => void;
}

function CategoryActions({ category, isFirst, isLast, onRefresh }: CategoryActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [reordering, startReorder] = useTransition();

  const handleReorder = (direction: "up" | "down") => {
    startReorder(async () => {
      const result = await reorderCategory(category.id, direction);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        onRefresh();
      }
    });
  };

  return (
    <>
      <CategoryDialog
        open={editOpen}
        category={category}
        onClose={() => setEditOpen(false)}
        onSaved={onRefresh}
      />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleReorder("up")}
          disabled={isFirst || reordering}
          aria-label="העלה קטגוריה"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleReorder("down")}
          disabled={isLast || reordering}
          aria-label="הורד קטגוריה"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setEditOpen(true)}
          aria-label="ערוך קטגוריה"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <DeleteConfirmDialog
          title={`מחיקת קטגוריה: ${category.nameHe}`}
          description={
            <span>
              פעולה זו תמחק את הקטגוריה לצמיתות.{" "}
              {category.parameters.length > 0 && (
                <strong>
                  {category.parameters.length} פרמטרים יימחקו גם כן.
                </strong>
              )}
            </span>
          }
          successMessage="קטגוריה נמחקה"
          errorMessage="שגיאה במחיקת קטגוריה"
          onDelete={() => deleteCategory(category.id)}
          onSuccess={onRefresh}
          trigger={
            <Button variant="ghost" size="icon" aria-label="מחק קטגוריה">
              <span className="text-destructive text-sm">מחק</span>
            </Button>
          }
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// BookCategoryClient — main client island
// ---------------------------------------------------------------------------

interface BookCategoryClientProps {
  initialCategories: AdminBookCategory[];
}

export function BookCategoryClient({ initialCategories }: BookCategoryClientProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [addOpen, setAddOpen] = useState(false);

  const refresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {categories.length} קטגוריות
        </p>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 ms-2" />
          קטגוריה חדשה
        </Button>
      </div>

      <CategoryDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={refresh}
      />

      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          אין קטגוריות עדיין. לחץ &quot;קטגוריה חדשה&quot; כדי להתחיל.
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="border rounded-lg p-4 space-y-3"
            >
              {/* Category header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-base leading-tight">
                    {cat.icon && (
                      <span className="me-1 text-muted-foreground">[{cat.icon}]</span>
                    )}
                    {cat.nameHe}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">
                    {cat.slug}
                  </p>
                </div>
                <CategoryActions
                  category={cat}
                  isFirst={idx === 0}
                  isLast={idx === categories.length - 1}
                  onRefresh={refresh}
                />
              </div>

              {/* Parameters list */}
              <div className="space-y-1">
                {cat.parameters.length === 0 ? (
                  <p className="text-xs text-muted-foreground">אין פרמטרים</p>
                ) : (
                  <ul className="space-y-1">
                    {cat.parameters.map((param) => (
                      <li key={param.id}>
                        <a
                          href={`/admin/book/parameters/${param.id}`}
                          className="flex items-center gap-2 text-sm hover:underline text-primary"
                        >
                          {param.number !== null && (
                            <span className="text-xs text-muted-foreground w-5 shrink-0 text-start">
                              {param.number}.
                            </span>
                          )}
                          <span>{param.nameHe}</span>
                          <span className="text-xs text-muted-foreground" dir="ltr">
                            ({param.slug})
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="pt-1">
                  <AddParameterButton categoryId={cat.id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
