import type { PlanKind } from "@/types/plans";

/**
 * An Arbox-paid Card is filed under the nearest catalog Card (the 10 or the
 * 20) but holds the sessions Arbox sold or had left. Named by its own sessions
 * when they differ, so a 3-session Card never reads as a 10 Card. An
 * Adjustment changes those sessions, so it renames the Card too: Arbox never
 * told us the size it was sold at.
 */
export function arboxCardName(
  product: { name_he: string; kind: PlanKind; sessions_total: number | null },
  planSessions: number | null,
): string {
  if (product.kind !== "session_card" || planSessions === null || planSessions === product.sessions_total) {
    return product.name_he;
  }
  return planSessions === 1 ? "כרטיסיית אימון אחד" : `כרטיסיית ${planSessions} אימונים`;
}
