import "server-only";

import { planTokenSecret } from "@/lib/plans/token-secret";
import { REPORT_TOKEN_TTL_SECONDS, signReportToken } from "./report-token";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.edengarden.co.il";

/**
 * `/report/<token>`: one sent Weekly report, opened by the parent without a
 * login, valid 30 days. Throws when PLAN_RENEWAL_TOKEN_SECRET is unset.
 */
export function buildReportUrl(reportId: string, nowUnix = Math.floor(Date.now() / 1000)): string {
  const token = signReportToken(reportId, nowUnix + REPORT_TOKEN_TTL_SECONDS, planTokenSecret());
  return `${SITE_URL}/report/${encodeURIComponent(token)}`;
}
