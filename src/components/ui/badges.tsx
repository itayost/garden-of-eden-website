"use client";

import { Badge } from "@/components/ui/badge";

/** Shown in place of a value the database left empty. */
function MissingValue() {
  return <span className="text-muted-foreground">-</span>;
}

/**
 * Role badge component
 * admin = red, trainer = blue, trainee = secondary
 * A missing role reads as trainee, the column default.
 */
export function RoleBadge({ role }: { role: string | null }) {
  switch (role) {
    case "admin":
      return <Badge className="bg-red-500">מנהל</Badge>;
    case "trainer":
      return <Badge className="bg-blue-500">מאמן</Badge>;
    default:
      return <Badge variant="secondary">מתאמן</Badge>;
  }
}

/**
 * Active/Inactive status badge
 * Active = green, Inactive = red
 */
export function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <Badge variant="outline" className="border-green-500 text-success">
        פעיל
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-red-500 text-red-600">
      לא פעיל
    </Badge>
  );
}

/**
 * Yes/No boolean badge
 */
export function YesNoBadge({ value }: { value: boolean }) {
  if (value) {
    return (
      <Badge variant="outline" className="border-green-500 text-success">
        כן
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-red-500 text-red-600">
      לא
    </Badge>
  );
}

/**
 * Difficulty level badge (1-10 scale)
 * High (8+) = destructive, Medium (5-7) = default, Low (<5) = secondary
 */
export function DifficultyBadge({ level }: { level: number | null }) {
  if (level === null) return <MissingValue />;
  const variant = level >= 8 ? "destructive" : level >= 5 ? "default" : "secondary";
  return <Badge variant={variant}>{level}/10</Badge>;
}

/**
 * Satisfaction level badge (1-10 scale)
 * High (8+) = green, Medium (5-7) = secondary, Low (<5) = destructive
 */
export function SatisfactionBadge({ level }: { level: number | null }) {
  if (level === null) return <MissingValue />;
  const variant = level >= 8 ? "default" : level >= 5 ? "secondary" : "destructive";
  const className = level >= 8 ? "bg-green-500" : "";
  return <Badge variant={variant} className={className}>{level}/10</Badge>;
}

/**
 * Yes/No badge with "יש/אין" text (for injuries, etc.)
 */
export function HasBadge({ value }: { value: boolean | null }) {
  if (value === null) return <MissingValue />;
  return value ? (
    <Badge variant="destructive">יש</Badge>
  ) : (
    <Badge variant="secondary">אין</Badge>
  );
}
