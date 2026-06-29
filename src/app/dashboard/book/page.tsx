import type { Metadata } from "next";
import { Suspense } from "react";
import { getBookTree } from "@/features/development-book/lib/actions";
import { Accordion } from "@/components/ui/accordion";
import { BookCover } from "@/features/development-book/components/trainee/BookCover";
import { CategoryNav } from "@/features/development-book/components/trainee/CategoryNav";
import { ParameterAccordionCard } from "@/features/development-book/components/trainee/ParameterAccordionCard";
import { MyContentToggle } from "@/features/development-book/components/trainee/MyContentToggle";

export const metadata: Metadata = {
  title: "ספר פיתוח שחקן | Garden of Eden",
};

// Force dynamic — depends on logged-in user profile (age group, position)
export const dynamic = "force-dynamic";

interface BookPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BookPage({ searchParams }: BookPageProps) {
  const params = await searchParams;
  const showAll = params.all === "1";

  const { categories, ageGroup, position, doneMap } = await getBookTree({ showAll });

  const hasContent = categories.some((cat) => cat.parameters.length > 0);

  return (
    <div className="space-y-0">
      {/* Cover / hero */}
      <BookCover
        categories={categories}
        ageGroup={ageGroup}
        position={position}
        showAll={showAll}
      />

      {/* Top controls */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-lg font-bold">תכנים</h2>
        <Suspense fallback={null}>
          <MyContentToggle showAll={showAll} />
        </Suspense>
      </div>

      {/* Category quick-nav */}
      <CategoryNav categories={categories} />

      {/* Empty state */}
      {!hasContent && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
          <p className="text-muted-foreground text-sm">
            {showAll
              ? "אין פרמטרים בספר עדיין"
              : "אין פרמטרים מותאמים לפרופיל שלך. לחץ על \"הצג הכל\" לצפייה בכל התכנים."}
          </p>
        </div>
      )}

      {/* Categories + parameters */}
      <div className="space-y-10">
        {categories.map((category) => (
          <section key={category.id} id={`cat-${category.slug}`}>
            {/* Category divider */}
            <div className="flex items-center gap-3 border-b border-primary/15 pb-3 mb-5">
              {category.icon && (
                <span className="text-2xl" aria-hidden="true">
                  {category.icon}
                </span>
              )}
              <h3 className="text-xl font-extrabold tracking-tight">
                {category.nameHe}
              </h3>
              <span className="text-xs text-muted-foreground tracking-widest ms-auto">
                {category.parameters.length} פרמטרים
              </span>
            </div>

            {category.parameters.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                אין פרמטרים בקטגוריה זו
              </p>
            ) : (
              <Accordion type="single" collapsible className="flex flex-col gap-3">
                {category.parameters.map((param) => (
                  <ParameterAccordionCard
                    key={param.id}
                    parameter={param}
                    traineeAgeGroup={ageGroup}
                    doneMap={doneMap}
                  />
                ))}
              </Accordion>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
