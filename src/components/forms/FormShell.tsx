import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface FormShellProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Rough fill time, e.g. "2 דקות". Sets expectation before the kid starts. */
  duration?: string;
  /** Show the auto-save hint (all forms using useFormDraft should). */
  autoSaves?: boolean;
  children: React.ReactNode;
}

/**
 * The branded frame every trainee form shares: forest chip with a gold icon,
 * title, and the promises that lower friction — how long it takes, and that
 * a draft never gets lost. Field internals stay entirely with the caller.
 */
export function FormShell({
  icon: Icon,
  title,
  description,
  duration,
  autoSaves = true,
  children,
}: FormShellProps) {
  const hints = [duration, autoSaves ? "נשמר אוטומטית" : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="mx-auto max-w-2xl rounded-2xl">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest">
          <Icon className="h-5 w-5 text-gold-light" />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
          {hints && <p className="mt-0.5 text-xs text-muted-foreground">{hints}</p>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
