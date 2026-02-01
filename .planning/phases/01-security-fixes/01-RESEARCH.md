# Phase 1: Security Fixes - Research

**Researched:** 2026-02-01
**Domain:** API Security, Rate Limiting, Webhook Security, Database RLS
**Confidence:** HIGH

## Summary

This research covers the security hardening required before launch: rate limiting, webhook signature verification, input validation with Zod, and Supabase RLS policies. The project uses Next.js 16.1.0, Supabase with existing RLS policies, and Zod v4.2.1 for validation.

The current codebase has significant security gaps:
1. **No rate limiting** on any API routes (including payments endpoint)
2. **No webhook signature verification** for GROW payment webhooks
3. **Many `as unknown as` type casts** (35+ instances) bypassing type safety
4. **Missing UPDATE/DELETE RLS policies** on several tables
5. **`is_active` soft delete** exists for profiles but not for assessments/forms

**Primary recommendation:** Use Upstash Rate Limit with sliding window algorithm, implement HMAC-SHA256 webhook verification with timestamp replay protection, and add Zod schemas at all API entry points.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@upstash/ratelimit` | ^2.0.5 | Rate limiting | Serverless-first, Redis-backed, sliding window support, used by Vercel |
| `@upstash/redis` | latest | Redis client for rate limiting | Required by @upstash/ratelimit, REST-based for edge |
| `zod` | ^4.2.1 | Runtime validation | Already in project, TypeScript-first, `safeParse` for error handling |
| `crypto` (Node.js built-in) | - | HMAC signature verification | Native module, no external dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vercel/functions` | latest | `waitUntil` for analytics | Background processing of rate limit analytics |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Upstash Rate Limit | In-memory Map | In-memory resets on cold start, doesn't work across instances/edge |
| Upstash Rate Limit | `express-rate-limit` | Designed for Express, not ideal for Next.js App Router |
| Upstash Redis | Vercel KV | Similar, but Upstash has better rate-limit-specific tooling |

**Installation:**
```bash
npm install @upstash/ratelimit @upstash/redis @vercel/functions
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── rate-limit.ts        # Rate limiting utilities
│   ├── webhook-security.ts  # HMAC verification helpers
│   └── validations/         # Zod schemas (already exists)
│       ├── payment.ts       # Payment endpoint validation
│       └── webhook.ts       # Webhook payload validation
├── app/api/
│   ├── payments/create/route.ts  # Rate-limited, validated
│   └── webhooks/grow/route.ts    # Signature verified
└── middleware.ts                  # Could add global rate limiting
```

### Pattern 1: Rate Limiting Middleware Pattern
**What:** Centralized rate limiting with per-route configuration
**When to use:** All API routes, with stricter limits on sensitive endpoints
**Example:**
```typescript
// Source: Context7 @upstash/ratelimit-js documentation
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 h"), // 10 per hour for payments
  prefix: "@upstash/ratelimit",
  analytics: true,
});

export async function checkRateLimit(
  identifier: string,
  customLimiter?: ReturnType<typeof Ratelimit.slidingWindow>
) {
  const { success, limit, remaining, pending } = await ratelimit.limit(identifier);
  return { rateLimited: !success, limit, remaining, pending };
}
```

### Pattern 2: Zod Validation at Entry Point
**What:** Parse and validate request body before any processing
**When to use:** Every API route handler, at the very start
**Example:**
```typescript
// Source: Context7 Zod documentation
import { z } from "zod";

const PaymentSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  paymentType: z.enum(["one_time", "recurring"]),
  payerName: z.string().min(2).max(100),
  payerPhone: z.string().regex(/^05\d{8}$/),
  payerEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = PaymentSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  // result.data is now fully typed and validated
  const validated = result.data;
  // ... proceed with validated data
}
```

### Pattern 3: Webhook Signature Verification
**What:** HMAC-SHA256 verification with timing-safe comparison and replay protection
**When to use:** All webhook endpoints
**Example:**
```typescript
// Source: webhooks.fyi HMAC documentation
import crypto from "crypto";

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp?: string,
  toleranceSeconds = 300 // 5 minutes
): boolean {
  // Replay protection via timestamp
  if (timestamp) {
    const webhookTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(webhookTime) || Math.abs(now - webhookTime) > toleranceSeconds) {
      return false; // Timestamp invalid or too old
    }
  }

  // Compute expected signature
  const hashPayload = timestamp ? `${timestamp}.${payload}` : payload;
  const hmac = crypto.createHmac("sha256", secret);
  const expectedSig = Buffer.from(hmac.update(hashPayload).digest("hex"), "utf8");
  const providedSig = Buffer.from(signature, "utf8");

  // Timing-safe comparison
  if (expectedSig.length !== providedSig.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedSig, providedSig);
}
```

### Pattern 4: Soft Delete with RLS
**What:** Add `deleted_at` column, hide deleted rows via RLS
**When to use:** Critical data tables (users, assessments)
**Example:**
```sql
-- Add soft delete column
ALTER TABLE player_assessments
  ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partial unique index for active records
CREATE UNIQUE INDEX idx_assessments_active_unique
  ON player_assessments(user_id, assessment_date)
  WHERE deleted_at IS NULL;

-- RLS policy hides deleted records
CREATE POLICY "Hide deleted assessments" ON player_assessments
  FOR SELECT
  USING (deleted_at IS NULL OR
         EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

### Anti-Patterns to Avoid
- **`as unknown as` type casts:** Replace with Zod `safeParse` for runtime validation
- **Trusting webhook payloads:** Always verify signature before processing
- **Rate limiting in client code:** Must be server-side, attackers bypass client
- **Hard-coded rate limit values:** Use environment variables for flexibility
- **Timing-unsafe string comparison:** Use `crypto.timingSafeEqual()` for signatures

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | In-memory Map counter | `@upstash/ratelimit` | Distributed, persists across restarts, sliding window algorithm |
| Signature verification | Simple string comparison | `crypto.timingSafeEqual` | Prevents timing attacks |
| Input validation | Manual if-else checks | Zod schemas | Type inference, better errors, composable |
| Replay protection | Custom timestamp logic | Include in signature + tolerance window | Standard pattern, well-tested |
| Password hashing | - | Use auth provider (Supabase Auth) | Already handled by Supabase |

**Key insight:** Security code is easy to get subtly wrong. Use battle-tested libraries that handle edge cases (timing attacks, race conditions, overflow).

## Common Pitfalls

### Pitfall 1: GROW Webhook Has No Signature Verification
**What goes wrong:** Current webhook endpoint trusts all incoming requests
**Why it happens:** GROW/Meshulam documentation doesn't prominently feature signature verification
**How to avoid:** Contact GROW support for webhook secret, or implement IP allowlisting + processToken validation
**Warning signs:** Webhook accepts requests from any source

### Pitfall 2: Rate Limit Identifier Choice
**What goes wrong:** Using only IP address allows authenticated user abuse; using only user ID blocks shared IPs
**Why it happens:** Oversimplified rate limiting strategy
**How to avoid:** Use user ID when authenticated, fall back to IP for anonymous; exempt admins
**Warning signs:** Legitimate users blocked, or abuse from authenticated accounts

### Pitfall 3: NaN from parseInt/parseFloat
**What goes wrong:** `parseInt("abc")` returns `NaN`, which passes truthy checks incorrectly
**Why it happens:** Current webhook code: `parseInt(data.paymentsNum) || 1` works, but `parseFloat` edge cases exist
**How to avoid:** Use Zod's `z.coerce.number()` or explicit `isNaN()` checks
**Warning signs:** Bad data silently converted to unexpected values

### Pitfall 4: Soft Delete Breaks Unique Constraints
**What goes wrong:** Can't re-create a deleted record with same unique key
**Why it happens:** Standard unique indexes include deleted rows
**How to avoid:** Use partial unique indexes: `WHERE deleted_at IS NULL`
**Warning signs:** "Duplicate key" errors when recreating soft-deleted data

### Pitfall 5: RLS Performance on Large Tables
**What goes wrong:** RLS policies with function calls slow down queries
**Why it happens:** `auth.uid()` called per row instead of cached
**How to avoid:** Wrap in `(SELECT auth.uid())` to cache per statement
**Warning signs:** Queries get slower as table grows

### Pitfall 6: Vague Error Messages Leak Information
**What goes wrong:** Error messages reveal security mechanisms (e.g., "Rate limited")
**Why it happens:** Default error messages are descriptive
**How to avoid:** Use generic messages like "Request failed. Please try again later."
**Warning signs:** Users or attackers can infer security rules from error messages

## Code Examples

Verified patterns from official sources:

### Rate Limiting in API Route
```typescript
// Source: Context7 @upstash/ratelimit-js
import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { waitUntil } from "@vercel/functions";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix: "payment",
  analytics: true,
});

export async function POST(request: NextRequest) {
  // Get identifier: user ID if authenticated, IP if anonymous
  const userId = request.headers.get("x-user-id"); // From auth middleware
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const identifier = userId || `ip:${ip}`;

  const { success, pending } = await ratelimit.limit(identifier);
  waitUntil(pending); // Handle analytics in background

  if (!success) {
    // Vague error per requirements
    return NextResponse.json(
      { error: "הבקשה נכשלה. נסה שוב מאוחר יותר" }, // Hebrew: Request failed
      { status: 429 }
    );
  }

  // Continue with request...
}
```

### Zod Validation with Hebrew Errors
```typescript
// Source: Context7 Zod documentation + project conventions
import { z } from "zod";

export const createPaymentSchema = z.object({
  amount: z.number({ error: "סכום לא תקין" }).positive({ error: "סכום חייב להיות חיובי" }),
  description: z.string().min(1, { error: "תיאור נדרש" }).max(500),
  paymentType: z.enum(["one_time", "recurring"], { error: "סוג תשלום לא תקין" }),
  payerName: z.string()
    .min(2, { error: "שם קצר מדי" })
    .refine(
      (name) => name.trim().split(/\s+/).filter(p => p.length >= 2).length >= 2,
      { message: "נא להזין שם מלא (פרטי ומשפחה)" }
    ),
  payerPhone: z.string().regex(/^05\d{8}$/, { error: "מספר טלפון לא תקין" }),
  payerEmail: z.string().email({ error: "אימייל לא תקין" }).optional(),
  paymentNum: z.number().int().positive().optional(),
  maxPaymentNum: z.number().int().positive().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
```

### RLS Policy with Performance Optimization
```sql
-- Source: Supabase RLS documentation
-- UPDATE policy for user-owned data with caching
CREATE POLICY "Users can update own assessments" ON player_assessments
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE policy (soft delete via UPDATE)
CREATE POLICY "Users cannot delete assessments" ON player_assessments
  FOR DELETE
  TO authenticated
  USING (false); -- No one can hard delete

-- Admin can see all including soft-deleted
CREATE POLICY "Admins can view all assessments" ON player_assessments
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );
```

### Webhook Verification with Replay Protection
```typescript
// Source: webhooks.fyi HMAC + replay-prevention documentation
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.GROW_WEBHOOK_SECRET!;
const TIMESTAMP_TOLERANCE = 300; // 5 minutes

export function verifyGrowWebhook(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): { valid: boolean; error?: string } {
  if (!signature) {
    return { valid: false, error: "Missing signature" };
  }

  // Replay protection
  if (timestamp) {
    const webhookTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);

    if (isNaN(webhookTime)) {
      return { valid: false, error: "Invalid timestamp" };
    }

    if (Math.abs(now - webhookTime) > TIMESTAMP_TOLERANCE) {
      return { valid: false, error: "Timestamp out of range" };
    }
  }

  // Compute expected signature
  const payload = timestamp ? `${timestamp}.${rawBody}` : rawBody;
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const expectedSig = Buffer.from(hmac.update(payload).digest("hex"), "utf8");
  const providedSig = Buffer.from(signature, "utf8");

  // Timing-safe comparison
  if (expectedSig.length !== providedSig.length) {
    return { valid: false, error: "Invalid signature" };
  }

  if (!crypto.timingSafeEqual(expectedSig, providedSig)) {
    return { valid: false, error: "Signature mismatch" };
  }

  return { valid: true };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-memory rate limiting | Distributed Redis (Upstash) | 2023+ | Works across serverless instances |
| `message` param in Zod | `error` param (Zod 4) | Zod 4.0 | Unified error customization API |
| `as unknown as` type casts | Zod runtime validation | Best practice | Type safety + runtime safety |
| Hard delete | Soft delete with `deleted_at` | Best practice | Data preservation, audit trail |
| `auth.uid() = user_id` | `(SELECT auth.uid()) = user_id` | Performance optimization | 99%+ improvement on large tables |

**Deprecated/outdated:**
- Zod 3 `required_error`/`invalid_type_error`: Use Zod 4 `error` parameter instead
- Simple string comparison for signatures: Use `crypto.timingSafeEqual()`

## Open Questions

Things that couldn't be fully resolved:

1. **GROW Webhook Signature Format**
   - What we know: GROW/Meshulam provides webhooks but documentation doesn't detail signature verification
   - What's unclear: Whether GROW sends a signature header, what algorithm they use
   - Recommendation: Contact GROW support for webhook secret and signature format; implement processToken validation as backup; consider IP allowlisting

2. **Admin Rate Limit Exemption Implementation**
   - What we know: Admins should bypass rate limits per requirements
   - What's unclear: Whether to check role in rate limit function or in each route
   - Recommendation: Create wrapper that checks user role before rate limiting

3. **Soft Delete for Forms (pre_workout, post_workout, nutrition)**
   - What we know: User wants soft delete on critical data
   - What's unclear: Whether form submissions should be soft-deletable (they're typically immutable audit records)
   - Recommendation: Add `deleted_at` to user and assessment tables only; forms are already append-only audit logs

## Testing Considerations

For Phase 1 testing requirements:

### Rate Limiting Tests
```typescript
// Pattern: Use vitest with mock Redis or test against real Upstash
import { describe, it, expect, vi } from "vitest";

describe("Rate Limiting", () => {
  it("should reject after exceeding limit", async () => {
    // Make requests up to limit
    for (let i = 0; i < 10; i++) {
      const response = await handler(mockRequest);
      expect(response.status).toBe(200);
    }
    // Next request should be rejected
    const response = await handler(mockRequest);
    expect(response.status).toBe(429);
  });

  it("should return vague error message", async () => {
    // Exceed limit
    const response = await handler(mockRequest);
    const body = await response.json();
    expect(body.error).not.toContain("rate");
    expect(body.error).not.toContain("limit");
  });
});
```

### Webhook Verification Tests
```typescript
describe("Webhook Signature Verification", () => {
  it("should reject missing signature", async () => {
    const response = await webhookHandler(mockRequestNoSig);
    expect(response.status).toBe(401);
  });

  it("should reject invalid signature", async () => {
    const response = await webhookHandler(mockRequestBadSig);
    expect(response.status).toBe(401);
  });

  it("should reject replay attacks (old timestamp)", async () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 min ago
    const response = await webhookHandler(mockRequestOldTimestamp);
    expect(response.status).toBe(401);
  });
});
```

### Zod Validation Tests
```typescript
describe("Payment Validation", () => {
  it("should reject malformed phone", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      payerPhone: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative amount", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      amount: -100,
    });
    expect(result.success).toBe(false);
  });
});
```

## Sources

### Primary (HIGH confidence)
- [Context7 @upstash/ratelimit-js](https://context7.com/upstash/ratelimit-js) - Rate limiting patterns, Next.js integration
- [Context7 Zod](https://context7.com/colinhacks/zod) - safeParse, error handling, Zod 4 changes
- [Context7 Next.js](https://context7.com/vercel/next.js) - Middleware, route handler patterns
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) - UPDATE/DELETE policies, performance

### Secondary (MEDIUM confidence)
- [webhooks.fyi HMAC](https://webhooks.fyi/security/hmac) - HMAC signature verification with timing-safe comparison
- [webhooks.fyi Replay Prevention](https://webhooks.fyi/security/replay-prevention) - Timestamp validation patterns
- [Hookdeck SHA256 Guide](https://hookdeck.com/webhooks/guides/how-to-implement-sha256-webhook-signature-verification) - Implementation best practices

### Tertiary (LOW confidence - requires validation)
- GROW webhook signature format - Not documented; contact support
- Specific Meshulam API security headers - Not found in public docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Context7 verified, widely used libraries
- Architecture patterns: HIGH - Based on official Next.js and Upstash docs
- Pitfalls: HIGH - Common issues verified across multiple sources
- GROW webhook specifics: LOW - Official docs lack signature verification details

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - security patterns are stable)
