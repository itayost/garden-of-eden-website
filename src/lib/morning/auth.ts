import "server-only";

import { getMorningConfig } from "./config";

interface CachedToken {
  accessToken: string;
  /** Unix seconds. */
  expiresAt: number;
}

/** Refresh a minute early so a request never carries a token about to die. */
const REFRESH_MARGIN_SECONDS = 60;

let cached: CachedToken | null = null;

/**
 * Morning issues a one-hour bearer token for client credentials. Fluid
 * Compute keeps a module instance warm across requests, so caching in the
 * module saves a token call per request; a cold instance just fetches one.
 */
export async function getMorningAccessToken(forceRefresh = false): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (!forceRefresh && cached && cached.expiresAt - REFRESH_MARGIN_SECONDS > now) {
    return cached.accessToken;
  }

  const { tokenBase, clientId, clientSecret } = getMorningConfig();
  const response = await fetch(`${tokenBase}/idp/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Morning token request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as { accessToken?: string; expiresAt?: number };
  if (!data.accessToken || !data.expiresAt) {
    throw new Error("Morning token response is missing accessToken or expiresAt");
  }

  cached = { accessToken: data.accessToken, expiresAt: data.expiresAt };
  return cached.accessToken;
}
