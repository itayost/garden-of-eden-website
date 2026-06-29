import type { BookCategoryWithParameters } from "@/features/development-book/lib/types";
import { cn } from "@/lib/utils";

interface CategoryNavProps {
  categories: BookCategoryWithParameters[];
}

export function CategoryNav({ categories }: CategoryNavProps) {
  if (categories.length === 0) return null;

  return (
    <nav
      aria-label="ניווט מהיר לקטגוריות"
      className="mb-8 overflow-x-auto scrollbar-hide"
    >
      <ul className="flex gap-2 pb-1">
        {categories.map((cat) => (
          <li key={cat.id}>
            <a
              href={`#cat-${cat.slug}`}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap",
                "rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold",
                "text-muted-foreground hover:text-foreground hover:border-primary/40",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              {cat.icon && <span aria-hidden="true">{cat.icon}</span>}
              <span>{cat.nameHe}</span>
              {cat.parameters.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold">
                  {cat.parameters.length}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
