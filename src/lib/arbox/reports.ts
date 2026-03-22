import { ARBOX_BASE_URL, ARBOX_PAGE_LIMIT, ARBOX_MAX_PAGES } from "./constants";

export interface EntranceReportEntry {
  readonly user_id: number | null;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly class_name: string | null;
  readonly date: string;
  readonly start_time: string;
  readonly location_name: string | null;
}

interface ArboxReportResponse {
  readonly statusCode: number;
  readonly data: readonly EntranceReportEntry[];
  readonly extra: readonly unknown[];
}

async function fetchEntranceReportPage(
  from: string,
  to: string,
  page: number,
): Promise<readonly EntranceReportEntry[]> {
  const apiKey = process.env.ARBOX_API_KEY;
  if (!apiKey) {
    throw new Error("ARBOX_API_KEY is not set");
  }

  const url = `${ARBOX_BASE_URL}/reports/entranceReport?fromDate=${encodeURIComponent(from)}&toDate=${encodeURIComponent(to)}&page=${page}&limit=${ARBOX_PAGE_LIMIT}`;
  const res = await fetch(url, {
    headers: {
      "api-key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Arbox entrance report failed: ${res.status}`);
  }

  const json: ArboxReportResponse = await res.json();
  return json.data;
}

export async function fetchEntranceReport(
  from: string,
  to: string,
): Promise<readonly EntranceReportEntry[]> {
  if (!from || !to || from > to) {
    throw new Error("Invalid date range for entrance report");
  }

  let all: readonly EntranceReportEntry[] = [];
  let page = 1;

  while (page <= ARBOX_MAX_PAGES) {
    const entries = await fetchEntranceReportPage(from, to, page);
    all = [...all, ...entries];
    if (entries.length < ARBOX_PAGE_LIMIT) break;
    page++;
  }

  return all;
}

export function calculateWeeklyAverage(
  totalSessions: number,
  fromDate: string,
  toDate: string,
): number {
  if (totalSessions === 0) return 0;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const diffMs = to.getTime() - from.getTime();
  if (diffMs < 0) return 0;
  const days = Math.max(1, diffMs / (1000 * 60 * 60 * 24));
  const weeks = days / 7;
  return totalSessions / Math.max(weeks, 1 / 7);
}
