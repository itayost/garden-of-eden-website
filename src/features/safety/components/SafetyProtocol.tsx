import { Phone, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EMERGENCY_NUMBERS, SAFETY_SECTIONS } from "../../../../content/safety-protocol";
import type { Branch } from "@/types/branches";

function localPhone(phone: string): string {
  return phone.startsWith("+972") ? `0${phone.slice(4)}` : phone;
}

/**
 * The staff protocol as a readable page. Emergency numbers and the branch
 * managers come first: on the field this is opened under stress, so the
 * dialable part is above the fold and the checklist follows.
 */
export function SafetyProtocol({ branches }: { branches: Branch[] }) {
  const managers = branches.filter((b) => b.manager_phone);
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        {EMERGENCY_NUMBERS.map((entry) => (
          <a
            key={entry.number}
            href={`tel:${entry.number}`}
            className="flex items-center justify-between rounded-2xl border-2 border-destructive/40 bg-destructive/5 px-5 py-4 transition-colors hover:bg-destructive/10"
          >
            <span className="text-lg font-bold">{entry.label}</span>
            <span className="font-display text-3xl tabular-nums text-destructive">
              {entry.number}
            </span>
          </a>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4" />
            מנהלי הסניפים
          </CardTitle>
        </CardHeader>
        <CardContent>
          {managers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              עדיין לא הוגדר טלפון למנהל סניף. ניתן להוסיף בעמוד הסניפים.
            </p>
          ) : (
            <ul className="divide-y">
              {managers.map((branch) => (
                <li key={branch.id} className="flex items-center justify-between py-2">
                  <span className="font-medium">{branch.name_he}</span>
                  <a
                    href={`tel:${branch.manager_phone}`}
                    dir="ltr"
                    className="font-mono text-sm underline"
                  >
                    {localPhone(branch.manager_phone!)}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {SAFETY_SECTIONS.map((section, index) => (
          <Card key={section.title} className="break-inside-avoid">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-start gap-2 text-base">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-bold text-cream">
                  {index + 1}
                </span>
                <span>
                  {section.title}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {section.subtitle}
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 ps-5 text-sm">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground print:hidden">
        <ShieldAlert className="h-3.5 w-3.5" />
        מגבלות רפואיות ואנשי קשר לחירום של כל מתאמן מופיעים בלוח היומי ובעמוד המתאמן.
      </p>
    </div>
  );
}
