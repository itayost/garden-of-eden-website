import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional call to action — an empty screen is an invitation to act. */
  cta?: { label: string; href: string };
  className?: string;
}

/**
 * The app's one empty-state card, replacing five hand-copied dashed cards.
 * Forest icon chip on a grass-tinted dashed frame; the CTA makes the empty
 * screen a starting point rather than a dead end.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  className,
}: EmptyStateProps) {
  return (
    <Card
      className={cn(
        "border-2 border-dashed border-grass/40 bg-grass/[0.03]",
        className,
      )}
    >
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-forest">
          <Icon className="h-5 w-5 text-gold-light" />
        </span>
        <div className="space-y-1">
          <p className="font-bold">{title}</p>
          {description && (
            <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {cta && (
          <Button asChild className="mt-1 rounded-full bg-forest hover:bg-forest-light">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
