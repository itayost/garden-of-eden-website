import "server-only";

import { createRedisClient } from "@/lib/rate-limit";
import { PAGE_REUSE_MS, type CachedPage } from "./pelecard-page-mapping";

/**
 * Remembers the Pelecard page last opened for an order, so reloading the
 * card page shows the same page instead of opening (and counting) a new
 * one. Without Redis nothing is remembered and every load opens a page.
 */

const redis = createRedisClient();

const keyFor = (orderId: string) => `goe:pelecard-page:${orderId}`;

export async function readCachedPage(orderId: string): Promise<unknown> {
  if (!redis) return null;
  try {
    return await redis.get(keyFor(orderId));
  } catch (error) {
    console.warn(`[pelecard-page] order ${orderId} cache read failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function rememberPage(orderId: string, page: CachedPage): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(keyFor(orderId), page, { px: PAGE_REUSE_MS });
  } catch (error) {
    console.warn(`[pelecard-page] order ${orderId} cache write failed:`, error instanceof Error ? error.message : error);
  }
}
