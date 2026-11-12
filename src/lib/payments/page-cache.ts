import "server-only";

import { createRedisClient } from "@/lib/rate-limit";
import { CHECKING_MS, PAGE_REUSE_MS, type CachedPage } from "./pelecard-page-mapping";

/**
 * Short-lived, per-order card page state in Redis, never in the database:
 * the Pelecard page last opened (so a reload shows it again instead of
 * opening and counting a new one), and a "being checked" mark after a result
 * Pelecard could not confirm yet (so a parent who may have paid is not shown
 * a new page). Without Redis nothing is remembered.
 */

const redis = createRedisClient();

const pageKey = (orderId: string) => `goe:pelecard-page:${orderId}`;
const checkingKey = (orderId: string) => `goe:pelecard-checking:${orderId}`;

function warn(orderId: string, what: string, error: unknown): void {
  console.warn(`[pelecard-page] order ${orderId} ${what} failed:`, error instanceof Error ? error.message : error);
}

export async function readCachedPage(orderId: string): Promise<unknown> {
  if (!redis) return null;
  try {
    return await redis.get(pageKey(orderId));
  } catch (error) {
    warn(orderId, "cache read", error);
    return null;
  }
}

export async function rememberPage(orderId: string, page: CachedPage): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(pageKey(orderId), page, { px: PAGE_REUSE_MS });
  } catch (error) {
    warn(orderId, "cache write", error);
  }
}

/**
 * After Pelecard ended the page (a decline), the next load opens a new one.
 * The "being checked" mark is left to expire: no unconfirmed request may
 * clear it.
 */
export async function forgetPage(orderId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(pageKey(orderId));
  } catch (error) {
    warn(orderId, "cache delete", error);
  }
}

export async function markChecking(orderId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(checkingKey(orderId), 1, { px: CHECKING_MS });
  } catch (error) {
    warn(orderId, "checking mark", error);
  }
}

export async function isChecking(orderId: string): Promise<boolean> {
  if (!redis) return false;
  try {
    return (await redis.get(checkingKey(orderId))) !== null;
  } catch (error) {
    warn(orderId, "checking read", error);
    return false;
  }
}
