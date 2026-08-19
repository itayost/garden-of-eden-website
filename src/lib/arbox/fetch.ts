import { ARBOX_BASE_URL, ARBOX_PAGE_LIMIT, ARBOX_MAX_PAGES } from "./constants";

/**
 * Fetching from Arbox with the retry and truncation behaviour every caller
 * needs.
 *
 * A nightly sweep makes ~50 serial calls, so a single transient 502 must not
 * abort the run, and a report that fills every page must say so rather than
 * silently return a partial answer that callers treat as complete.
 *
 * `retention.ts` has its own copy of this from before. It is left alone on
 * purpose: it drives a live financial report, its fetch path has no test
 * coverage, and de-duplicating it buys nothing that justifies the risk.
 */

interface ReportResponse<T> {
  readonly data?: readonly T[];
}

function apiKey(): string {
  const key = process.env.ARBOX_API_KEY;
  if (!key) throw new Error("ARBOX_API_KEY env var is not set");
  return key;
}

/** GET one Arbox path, retrying 429s and 5xx with exponential backoff. */
export async function arboxGet<T>(path: string, attempt = 1): Promise<T> {
  const response = await fetch(`${ARBOX_BASE_URL}${path}`, {
    headers: { "api-key": apiKey(), Accept: "application/json" },
    cache: "no-store",
  });

  if ((response.status === 429 || response.status >= 500) && attempt < 6) {
    const delayMs =
      response.status === 429
        ? 1000 * 2 ** (attempt - 1)
        : 500 * 2 ** (attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return arboxGet<T>(path, attempt + 1);
  }

  if (!response.ok) {
    const name = path.split("?")[0];
    throw new Error(`Arbox ${name} failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

/**
 * Every page of a report.
 *
 * Throws when the page cap is hit on a still-full page: a truncated membership
 * list would drop real members out of the "ever paid to train" set, and the
 * caller would write that loss to the database as fact. Failing the sync is the
 * safe outcome.
 */
export async function fetchArboxReport<T>(
  reportName: string,
  params: Readonly<Record<string, string>> = {}
): Promise<T[]> {
  const all: T[] = [];
  const extra = Object.entries(params)
    .map(([k, v]) => `&${k}=${encodeURIComponent(v)}`)
    .join("");

  let lastPageWasFull = false;
  for (let page = 1; page <= ARBOX_MAX_PAGES; page++) {
    const json = await arboxGet<ReportResponse<T>>(
      `/reports/${reportName}?reportName=${reportName}&limit=${ARBOX_PAGE_LIMIT}&page=${page}${extra}`
    );
    const rows = json.data ?? [];
    all.push(...rows);
    lastPageWasFull = rows.length >= ARBOX_PAGE_LIMIT;
    if (!lastPageWasFull) break;
  }

  if (lastPageWasFull) {
    throw new Error(
      `Arbox ${reportName} hit ARBOX_MAX_PAGES (${ARBOX_MAX_PAGES}) with a full last page; ` +
        `results would be truncated at ${ARBOX_MAX_PAGES * ARBOX_PAGE_LIMIT} rows`
    );
  }

  return all;
}
