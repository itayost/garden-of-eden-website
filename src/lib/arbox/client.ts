const BASE_URL = "https://arboxserver.arboxapp.com/api/public/v3";

export type ArboxUser = {
  user_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  birthday: string | null;
  created_at: string;
  address: string | null;
  city: string | null;
  personal_id: number | null;
  active_membership: string | null;
  last_entrance: string | null;
  location_name: string | null;
};

type ArboxUsersResponse = {
  statusCode: number;
  data: ArboxUser[];
};

async function fetchArboxUsersPage(page: number): Promise<ArboxUser[]> {
  const apiKey = process.env.ARBOX_API_KEY;
  if (!apiKey) throw new Error("ARBOX_API_KEY env var is not set");

  const url = `${BASE_URL}/users?page=${page}&limit=500&sort=asc`;
  const response = await fetch(url, {
    headers: { "api-key": apiKey, Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Arbox API error: ${response.status} ${response.statusText}`
    );
  }

  const json: ArboxUsersResponse = await response.json();
  // Arbox doesn't return full_name — construct it from first_name + last_name
  return (json.data ?? []).map((u) => ({
    ...u,
    full_name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
  }));
}

/**
 * Fetch all Arbox users, paginating 500/page until exhausted.
 */
export async function fetchAllArboxUsers(): Promise<ArboxUser[]> {
  const all: ArboxUser[] = [];
  let page = 1;

  while (true) {
    const users = await fetchArboxUsersPage(page);
    all.push(...users);
    if (users.length < 500) break;
    page++;
  }

  return all;
}
