/**
 * Duplicate rules for leads. A phone is unique within a tab, not across tabs:
 * staff paste a monthly list into a new tab even when the same people are in
 * an older one. Pure: the server action reads what the tab already holds.
 */

/** What a tab already holds: its phones, and the names of its leads with no phone. */
export interface TabLeads {
  readonly phones: ReadonlySet<string>;
  /** Keys from leadNameKey. */
  readonly phonelessNames: ReadonlySet<string>;
}

/** A name compared ignoring case and extra spaces. */
export function leadNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export interface LeadImportPlan<T> {
  readonly insert: T[];
  readonly skipped: number;
}

/**
 * The rows to insert into a tab. A row is skipped when its phone is already
 * in the tab, or, with no phone, when a phone-less lead of the same name is;
 * a phone or phone-less name repeated within the paste is added once. Without
 * the name rule, every retry of a paste added its phone-less rows again.
 */
export function planLeadImport<T extends { readonly name: string; readonly phone: string | null }>(
  rows: readonly T[],
  inTab: TabLeads,
): LeadImportPlan<T> {
  const phones = new Set(inTab.phones);
  const names = new Set(inTab.phonelessNames);
  const insert: T[] = [];
  for (const row of rows) {
    const seen = row.phone !== null ? phones : names;
    const key = row.phone ?? leadNameKey(row.name);
    if (seen.has(key)) continue;
    seen.add(key);
    insert.push(row);
  }
  return { insert, skipped: rows.length - insert.length };
}

/**
 * When a tab is deleted its leads move to another tab. A lead whose phone the
 * destination already has would break the per-tab rule, so it stays with the
 * deleted tab instead of failing the whole move.
 */
export function partitionTabMove(
  sourcePhones: readonly string[],
  destinationPhones: ReadonlySet<string>,
): { move: string[]; keep: string[] } {
  const unique = [...new Set(sourcePhones)];
  return {
    move: unique.filter((phone) => !destinationPhones.has(phone)),
    keep: unique.filter((phone) => destinationPhones.has(phone)),
  };
}
