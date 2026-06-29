import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
  BookCategoryWithParameters,
  BookParameterWithChildren,
} from "@/features/development-book/lib/types";

// --- Parameter card for parents view ---

interface ParentsParamCardProps {
  parameter: BookParameterWithChildren;
}

function ParentsParamCard({ parameter }: ParentsParamCardProps) {
  const hasParentsContent = parameter.reportTextHe || parameter.reportHighlightHe;

  if (!hasParentsContent) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-sky-200 bg-white dark:border-sky-900 dark:bg-sky-950/20",
        "p-5 space-y-3 shadow-sm"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {parameter.number !== null && (
          <span className="shrink-0 inline-flex items-center justify-center rounded-md border border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/40 px-2 py-1 text-[10px] font-extrabold text-sky-600 dark:text-sky-400 tracking-wider min-w-[36px]">
            {parameter.number}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm text-foreground leading-tight">{parameter.nameHe}</h3>
          {parameter.subtitleHe && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{parameter.subtitleHe}</p>
          )}
        </div>
      </div>

      {/* Report text */}
      {parameter.reportTextHe && (
        <p className="text-sm text-muted-foreground leading-relaxed">{parameter.reportTextHe}</p>
      )}

      {/* Report highlight */}
      {parameter.reportHighlightHe && (
        <div className="rounded-lg border border-sky-300/60 bg-sky-50 dark:border-sky-700/60 dark:bg-sky-900/30 px-4 py-3">
          <p className="text-xs text-sky-700 dark:text-sky-300 leading-relaxed font-medium">
            {parameter.reportHighlightHe}
          </p>
        </div>
      )}
    </div>
  );
}

// --- Category section ---

interface CategorySectionProps {
  category: BookCategoryWithParameters;
}

function CategorySection({ category }: CategorySectionProps) {
  const paramsWithContent = category.parameters.filter(
    (p) => p.reportTextHe || p.reportHighlightHe
  );

  if (paramsWithContent.length === 0) return null;

  return (
    <section aria-labelledby={`parents-cat-${category.id}`} className="space-y-3">
      <div className="flex items-center gap-2.5 border-b border-sky-200 dark:border-sky-900 pb-2.5">
        {category.icon && (
          <span className="text-xl" aria-hidden="true">
            {category.icon}
          </span>
        )}
        <h2
          id={`parents-cat-${category.id}`}
          className="text-base font-extrabold tracking-tight text-foreground"
        >
          {category.nameHe}
        </h2>
        <span className="text-[10px] text-muted-foreground tracking-widest ms-auto">
          {paramsWithContent.length} פרמטרים
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {paramsWithContent.map((param) => (
          <ParentsParamCard key={param.id} parameter={param} />
        ))}
      </div>
    </section>
  );
}

// --- Page root ---

interface ParentsPageProps {
  categories: BookCategoryWithParameters[];
}

export function ParentsPage({ categories }: ParentsPageProps) {
  const categoriesWithContent = categories.filter((cat) =>
    cat.parameters.some((p) => p.reportTextHe || p.reportHighlightHe)
  );

  return (
    <div className="space-y-8 pb-16" dir="rtl">
      {/* Back nav */}
      <div>
        <Link
          href="/dashboard/book"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← ספר פיתוח שחקן
        </Link>
      </div>

      {/* Page header */}
      <header className="space-y-1.5">
        <p className="text-[10px] font-bold tracking-[0.2em] text-sky-500 uppercase">
          Garden of Eden Soccer Academy
        </p>
        <h1 className="text-2xl font-black text-foreground leading-tight">
          מה אנחנו בונים עם הילד שלך
        </h1>
        <p className="text-sm text-muted-foreground">
          פרמטרי הפיתוח — לפי עמדה ולפי גיל — מה לצפות ומתי
        </p>
      </header>

      {/* Empty state */}
      {categoriesWithContent.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
          <p className="text-sm text-muted-foreground">אין תוכן להורים זמין לפרופיל שלך</p>
        </div>
      )}

      {/* Categories */}
      {categoriesWithContent.map((category) => (
        <CategorySection key={category.id} category={category} />
      ))}
    </div>
  );
}
