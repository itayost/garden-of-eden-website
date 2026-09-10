"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TERMS_SECTIONS, TERMS_VERSION } from "../../../../content/terms-kiryat-ata";

export function TermsBody() {
  return (
    <div className="space-y-6 text-sm leading-6">
      {TERMS_SECTIONS.map((section) => (
        <section key={section.title}>
          <h3 className="mb-2 font-bold">{section.title}</h3>
          <ul className="list-disc space-y-1 ps-5">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">גרסה {TERMS_VERSION}</p>
    </div>
  );
}

/** The תקנון, opened from the declaration checkbox without leaving the form. */
export function TermsSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button type="button" className="underline underline-offset-2">
          תקנון גארדן אוף עדן
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle>תקנון סניף קריית אתא</SheetTitle>
        </SheetHeader>
        <div className="py-4">
          <TermsBody />
        </div>
      </SheetContent>
    </Sheet>
  );
}
