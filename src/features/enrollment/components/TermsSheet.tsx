"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { LandingBranchKey } from "@/lib/branches/landing-branches";
import { termsFor } from "../../../../content/terms";

/** A branch's תקנון; with no branch, the קריית אתא one (termsFor). */
export function TermsBody({ branch }: { branch: LandingBranchKey | null }) {
  const { sections, version } = termsFor(branch);
  return (
    <div className="space-y-6 text-sm leading-6">
      {sections.map((section) => (
        <section key={section.title}>
          <h3 className="mb-2 font-bold">{section.title}</h3>
          <ul className="list-disc space-y-1 ps-5">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">גרסה {version}</p>
    </div>
  );
}

/** The branch's תקנון, opened from the declaration checkbox without leaving the form. */
export function TermsSheet({ branch }: { branch: LandingBranchKey | null }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button type="button" className="underline underline-offset-2">
          תקנון גארדן אוף עדן
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto" dir="rtl" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{termsFor(branch).title}</SheetTitle>
        </SheetHeader>
        <div className="py-4">
          <TermsBody branch={branch} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
