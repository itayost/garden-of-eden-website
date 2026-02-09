/**
 * Supabase helper functions for type-safe operations with dynamic table names
 *
 * These helpers exist because Supabase's generated types don't support dynamic table names.
 * Using `as any` in a centralized location is cleaner than scattering it across the codebase.
 *
 * Use `typedFrom()` for read queries (select, filter, etc.)
 * Use the named helpers for write operations (insert, update, upsert)
 */

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Type-safe wrapper around supabase.from() for tables not in generated types.
 * Centralizes the single `as any` cast so callers stay clean.
 *
 * Usage: `const { data } = await typedFrom(supabase, "my_table").select("*").eq("id", id).single();`
 *
 * When Supabase types are generated, update this single function instead of every call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function typedFrom(supabase: SupabaseClient, table: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table);
}

/**
 * Insert data into a Supabase table dynamically
 * @param supabase - Supabase client instance
 * @param table - Table name
 * @param data - Data to insert
 * @returns Promise with error or null
 */
export async function insertIntoTable(
  supabase: SupabaseClient,
  table: string,
  data: Record<string, unknown>
): Promise<{ error: Error | null }> {
  const { error } = await typedFrom(supabase, table).insert(data);
  return { error };
}

/**
 * Insert data and return the created record
 * @param supabase - Supabase client instance
 * @param table - Table name
 * @param data - Data to insert
 * @returns Promise with data and error
 */
export async function insertAndSelect<T>(
  supabase: SupabaseClient,
  table: string,
  data: Record<string, unknown>
): Promise<{ data: T | null; error: Error | null }> {
  const result = await typedFrom(supabase, table).insert(data).select().single();
  return { data: result.data as T | null, error: result.error };
}

/**
 * Update data in a Supabase table dynamically
 * @param supabase - Supabase client instance
 * @param table - Table name
 * @param data - Data to update
 * @param column - Column to filter by
 * @param value - Value to match
 * @returns Promise with error or null
 */
export async function updateInTable(
  supabase: SupabaseClient,
  table: string,
  data: Record<string, unknown>,
  column: string,
  value: string | number
): Promise<{ error: Error | null }> {
  const { error } = await typedFrom(supabase, table).update(data).eq(column, value);
  return { error };
}

/**
 * Upsert data in a Supabase table dynamically
 * @param supabase - Supabase client instance
 * @param table - Table name
 * @param data - Data to upsert
 * @returns Promise with error or null
 */
export async function upsertIntoTable(
  supabase: SupabaseClient,
  table: string,
  data: Record<string, unknown>
): Promise<{ error: Error | null }> {
  const { error } = await typedFrom(supabase, table).upsert(data);
  return { error };
}
