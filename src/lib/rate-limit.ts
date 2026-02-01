/**
 * Rate Limiting Utility
 *
 * Provides distributed rate limiting using Upstash Redis.
 * Designed for serverless/edge environments.
 *
 * Configuration via environment variables:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request should be blocked */
  rateLimited: boolean;
  /** Maximum requests allowed in the window */
  limit: number;
  /** Remaining requests in the current window */
  remaining: number;
  /** Promise that resolves when analytics are recorded (use with waitUntil) */
  pending: Promise<unknown>;
}

/**
 * Create Redis client from environment variables.
 * Uses Redis.fromEnv() which reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 */
function createRedisClient(): Redis | null {
  try {
    return Redis.fromEnv();
  } catch {
    console.error("[rate-limit] Failed to create Redis client. Rate limiting disabled.");
    return null;
  }
}

const redis = createRedisClient();

/**
 * Payment rate limiter: 10 requests per hour
 * Used for sensitive operations like payment processing
 */
const paymentLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "goe:payment",
      analytics: true,
    })
  : null;

/**
 * General rate limiter: 100 requests per minute
 * Used for standard API endpoints
 */
const generalLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      prefix: "goe:general",
      analytics: true,
    })
  : null;

/**
 * Check rate limit for an identifier.
 *
 * @param identifier - User ID or IP-based identifier
 * @param type - Type of rate limit to check ('payment' for sensitive ops, 'general' for standard)
 * @returns Rate limit result with remaining quota and pending analytics promise
 *
 * @example
 * ```ts
 * const result = await checkRateLimit(userId, 'payment');
 * if (result.rateLimited) {
 *   return new Response('Too many requests', { status: 429 });
 * }
 * // Use waitUntil to record analytics without blocking response
 * waitUntil(result.pending);
 * ```
 */
export async function checkRateLimit(
  identifier: string,
  type: "payment" | "general"
): Promise<RateLimitResult> {
  const limiter = type === "payment" ? paymentLimiter : generalLimiter;

  // Fail open: if Redis is unavailable, don't block legitimate users
  if (!limiter) {
    console.warn("[rate-limit] Rate limiter unavailable, allowing request");
    return {
      rateLimited: false,
      limit: type === "payment" ? 10 : 100,
      remaining: type === "payment" ? 10 : 100,
      pending: Promise.resolve(),
    };
  }

  try {
    const result = await limiter.limit(identifier);

    return {
      rateLimited: !result.success,
      limit: result.limit,
      remaining: result.remaining,
      pending: result.pending,
    };
  } catch (error) {
    // Fail open on Redis errors for availability
    console.error("[rate-limit] Rate limit check failed:", error);
    return {
      rateLimited: false,
      limit: type === "payment" ? 10 : 100,
      remaining: type === "payment" ? 10 : 100,
      pending: Promise.resolve(),
    };
  }
}

/**
 * Check if a user role should be exempt from rate limiting.
 * Admin users bypass all rate limits.
 *
 * @param role - User role from the session/database
 * @returns true if the user should bypass rate limits
 *
 * @example
 * ```ts
 * if (!isAdminExempt(user.role)) {
 *   const result = await checkRateLimit(user.id, 'payment');
 *   if (result.rateLimited) return new Response('Too many requests', { status: 429 });
 * }
 * ```
 */
export function isAdminExempt(role: string | null | undefined): boolean {
  return role === "admin";
}

/**
 * Get a consistent identifier for rate limiting.
 * Uses user ID for authenticated users, IP-prefixed string for anonymous.
 *
 * @param userId - User ID if authenticated, null/undefined otherwise
 * @param ip - IP address from request headers
 * @returns Identifier string for rate limiting
 *
 * @example
 * ```ts
 * const ip = request.headers.get('x-forwarded-for') || 'unknown';
 * const identifier = getRateLimitIdentifier(user?.id, ip);
 * const result = await checkRateLimit(identifier, 'general');
 * ```
 */
export function getRateLimitIdentifier(
  userId: string | null | undefined,
  ip: string
): string {
  return userId || `ip:${ip}`;
}
