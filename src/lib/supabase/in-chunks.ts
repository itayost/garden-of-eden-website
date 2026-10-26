/**
 * Reads keyed by an id list that grows with the academy.
 *
 * PostgREST takes `.in()` values in the request URL, and Supabase's gateway
 * answers 400 to a query string much past 24,800 characters, about 640 uuids.
 * Staff lists that sent every trainee in scope in one request started failing
 * on 2026-10-21, when the academy passed that size. These helpers send the
 * ids a slice at a time and join the answers.
 */

/** Ids per request: about 7,800 URL characters, well under the gateway's cap. */
export const ID_CHUNK = 200;

/** PostgREST returns at most this many rows to one request. */
const PAGE = 1000;

type ReadError = { message: string };

type RangeRead<Row> = {
  range(from: number, to: number): PromiseLike<{ data: Row[] | null; error: ReadError | null }>;
};

type CountRead = PromiseLike<{ count: number | null; error: ReadError | null }>;

/** Splits a list into slices of at most `size`. */
export function chunk<T>(items: readonly T[], size: number = ID_CHUNK): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
}

/**
 * Every row a query returns for these ids, one slice of ids per request and
 * page by page within a slice. `query` builds the read for one slice; when a
 * slice can match more than 1000 rows it must order by a unique column so the
 * pages do not overlap. Rows come back slice by slice, not in query order:
 * a caller that shows them in order sorts the joined list.
 */
export async function readInChunks<Row>(
  ids: readonly string[],
  query: (slice: string[]) => RangeRead<Row>,
): Promise<{ data: Row[]; error: ReadError | null }> {
  const slices = await Promise.all(chunk(ids).map((slice) => readAllPages(slice, query)));
  const failed = slices.find((result) => result.error !== null);
  if (failed) return { data: [], error: failed.error };
  return { data: slices.flatMap((result) => result.data), error: null };
}

async function readAllPages<Row>(
  slice: string[],
  query: (slice: string[]) => RangeRead<Row>,
): Promise<{ data: Row[]; error: ReadError | null }> {
  for (let from = 0, rows: Row[] = []; ; from += PAGE) {
    const { data, error } = await query(slice).range(from, from + PAGE - 1);
    if (error) return { data: [], error };
    const next = rows.concat(data ?? []);
    if ((data ?? []).length < PAGE) return { data: next, error: null };
    rows = next;
  }
}

/** The total of an exact count over these ids, one slice of ids per request. */
export async function countInChunks(
  ids: readonly string[],
  query: (slice: string[]) => CountRead,
): Promise<{ count: number; error: ReadError | null }> {
  const slices = await Promise.all(chunk(ids).map((slice) => query(slice)));
  const failed = slices.find((result) => result.error !== null);
  if (failed) return { count: 0, error: failed.error };
  return { count: slices.reduce((sum, result) => sum + (result.count ?? 0), 0), error: null };
}

// The database collates with ICU en-US; the same collator puts merged slices
// back in the order `order by full_name` gives.
const dbCollator = new Intl.Collator("en-US");

/** As `order by full_name`: ICU en-US, nulls last. */
export function byFullName(
  a: { full_name: string | null },
  b: { full_name: string | null },
): number {
  if (a.full_name === null || b.full_name === null) {
    if (a.full_name === b.full_name) return 0;
    return a.full_name === null ? 1 : -1;
  }
  return dbCollator.compare(a.full_name, b.full_name);
}

/**
 * As `order by <column> desc` on a timestamp. The database writes every
 * timestamp in UTC, so the strings sort as the instants do, even where a
 * fraction of a second is written shorter (".07" before ".073464"). Nulls
 * first, as Postgres puts them in a descending order.
 */
export function newestFirst<K extends string>(column: K) {
  return (a: Record<K, string | null>, b: Record<K, string | null>): number => {
    const x = a[column];
    const y = b[column];
    if (x === y) return 0;
    if (x === null) return -1;
    if (y === null) return 1;
    return x < y ? 1 : -1;
  };
}
