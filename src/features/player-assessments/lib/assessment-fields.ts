/**
 * The columns an assessment write may take from its caller.
 *
 * Server-action arguments are not checked at runtime, so the type alone does
 * not stop a crafted call. Identity, audit and soft-delete columns are always
 * set by the server; on an edit, user_id is too, so an assessment can never be
 * moved to another trainee (whose rating card the service-role snapshot write
 * would then update).
 */
const SERVER_OWNED = ["id", "assessed_by", "created_at", "deleted_at", "deleted_by"] as const;

function without<T extends object>(row: T, keys: readonly string[]): Partial<T> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key))) as Partial<T>;
}

export function assessmentInsertFields<T extends object>(input: T): Partial<T> {
  return without(input, SERVER_OWNED);
}

export function assessmentUpdateFields<T extends object>(patch: T): Partial<T> {
  return without(patch, [...SERVER_OWNED, "user_id"]);
}
