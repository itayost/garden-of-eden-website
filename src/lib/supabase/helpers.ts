/**
 * Supabase helper functions for type-safe operations with dynamic table names
 *
 * These helpers exist because Supabase's generated types don't support dynamic table names.
 * Using `as any` in a centralized location is cleaner than scattering it across the codebase.
 */

import { SupabaseClient } from "@supabase/supabase-js";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from(table).insert(data);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (supabase as any).from(table).insert(data).select().single();
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from(table).update(data).eq(column, value);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from(table).upsert(data);
  return { error };
}
