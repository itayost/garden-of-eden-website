import { ARBOX_BASE_URL } from "./constants";

const BASE_URL = ARBOX_BASE_URL;

export type ArboxUser = {
  user_id: number;
  name: string; // full name from report
  email: string | null;
  phone: string | null;
  gender: string | null;
  age: number | null;
  created_at: string;
  location_name: string | null;
  address: string | null;
  last_purchase: string | null;
};

export type ArboxBirthdayEntry = {
  user_id: number;
  name: string;
  birthday: string | null; // "YYYY-MM-DD"
  phone: string | null;
};

type ArboxReportResponse = {
  statusCode: number;
  data: ArboxUser[];
  extra: {
    pagination: {
      total: number;
      total_pages: number;
    };
  };
};

type ArboxBirthdayReportResponse = {
  statusCode: number;
  data: ArboxBirthdayEntry[];
  extra: {
    pagination: {
      total: number;
      total_pages: number;
    };
  };
};

async function fetchAllClientsPage(page: number): Promise<ArboxUser[]> {
  const apiKey = process.env.ARBOX_API_KEY;
  if (!apiKey) throw new Error("ARBOX_API_KEY env var is not set");

  const url = `${BASE_URL}/reports/allClientsReport?group_by=user&reportName=allClientsReport&page=${page}&limit=500`;
  const response = await fetch(url, {
    headers: { "api-key": apiKey, Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Arbox API error: ${response.status} ${response.statusText}`
    );
  }

  const json: ArboxReportResponse = await response.json();
  return json.data ?? [];
}

/**
 * Fetch all clients from the Arbox allClientsReport, paginating until exhausted.
 */
const MAX_PAGES = 50;

export async function fetchAllArboxUsers(): Promise<ArboxUser[]> {
  const all: ArboxUser[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const users = await fetchAllClientsPage(page);
    all.push(...users);
    if (users.length < 500) break;
    page++;
  }

  return all;
}

// ===========================================
// BIRTHDAY REPORT
// ===========================================

async function fetchBirthdayReportPage(
  fromDate: string,
  toDate: string,
  page: number,
): Promise<ArboxBirthdayEntry[]> {
  const apiKey = process.env.ARBOX_API_KEY;
  if (!apiKey) throw new Error("ARBOX_API_KEY env var is not set");

  const url = `${BASE_URL}/reports/birthdayReport?group_by=user&reportName=birthdayReport&fromDate=${fromDate}&toDate=${toDate}&page=${page}&limit=500`;
  const response = await fetch(url, {
    headers: { "api-key": apiKey, Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Arbox birthday report error: ${response.status} ${response.statusText}`
    );
  }

  const json: ArboxBirthdayReportResponse = await response.json();
  return json.data ?? [];
}

/**
 * Fetch all client birthdays from Arbox.
 * The birthday report is limited to 31-day windows, so we iterate
 * through all 12 months to capture every birthday.
 * Returns a Map of arbox_user_id -> birthday (YYYY-MM-DD).
 */
export async function fetchArboxBirthdays(): Promise<Map<number, string>> {
  const birthdays = new Map<number, string>();

  // Iterate through 12 months (Jan 1 - Dec 31) using a fixed non-leap year range
  const months = [
    { from: "2000-01-01", to: "2000-01-31" },
    { from: "2000-02-01", to: "2000-02-29" },
    { from: "2000-03-01", to: "2000-03-31" },
    { from: "2000-04-01", to: "2000-04-30" },
    { from: "2000-05-01", to: "2000-05-31" },
    { from: "2000-06-01", to: "2000-06-30" },
    { from: "2000-07-01", to: "2000-07-31" },
    { from: "2000-08-01", to: "2000-08-31" },
    { from: "2000-09-01", to: "2000-09-30" },
    { from: "2000-10-01", to: "2000-10-31" },
    { from: "2000-11-01", to: "2000-11-30" },
    { from: "2000-12-01", to: "2000-12-31" },
  ];

  for (const { from, to } of months) {
    let page = 1;

    while (page <= MAX_PAGES) {
      const entries = await fetchBirthdayReportPage(from, to, page);

      for (const entry of entries) {
        if (entry.user_id && entry.birthday) {
          birthdays.set(entry.user_id, entry.birthday);
        }
      }

      if (entries.length < 500) break;
      page++;
    }
  }

  return birthdays;
}
