const BASE_URL = "https://arboxserver.arboxapp.com/api/public/v3";

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
