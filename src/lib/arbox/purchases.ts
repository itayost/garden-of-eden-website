import { monthWindows } from "./access";
import { fetchArboxReport } from "./fetch";
import {
  purchasesFromReports,
  type ArboxPurchase,
  type MembershipsReportRow,
  type SalesReportRow,
  type SessionsReportRow,
  type UnmatchedCard,
} from "./purchase-rows";

/** Arbox has no sales before this month; earlier cards cannot be keyed. */
const SALES_HISTORY_START = "2026-02-01";

/** Every live card and membership in Arbox, keyed by Arbox's purchase id. */
export async function fetchArboxPurchases(
  now: Date,
): Promise<{ purchases: ArboxPurchase[]; unmatchedCards: UnmatchedCard[] }> {
  const cards = await fetchArboxReport<SessionsReportRow>("sessionsReport");
  const memberships = await fetchArboxReport<MembershipsReportRow>("activeMembershipsReport");
  // Serial on purpose, like the access step: Arbox rate-limits bursts.
  const salesPages: SalesReportRow[][] = [];
  for (const window of monthWindows(SALES_HISTORY_START, now)) {
    salesPages.push(await fetchArboxReport<SalesReportRow>("salesReport", { fromDate: window.from, toDate: window.to }));
  }
  return purchasesFromReports({ cards, memberships, sales: salesPages.flat() });
}
