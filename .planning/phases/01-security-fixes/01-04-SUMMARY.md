---
phase: 01-security-fixes
plan: 04
subsystem: payments
tags: [webhook, security, validation, zod, hmac]
dependency-graph:
  requires: [01-01]
  provides: [secure-webhook-endpoint, webhook-validation-schema]
  affects: [payments-processing]
tech-stack:
  added: []
  patterns: [zod-transforms, hmac-signature-verification, graceful-nan-handling]
key-files:
  created:
    - src/lib/validations/webhook.ts
  modified:
    - src/app/api/webhooks/grow/route.ts
decisions:
  - id: graceful-nan-handling
    choice: "Default to 1 for paymentsNum/allPaymentsNum, null for payment sums"
    rationale: "Prevents crashes on malformed data while maintaining sensible defaults"
  - id: signature-fallback
    choice: "Fall back to process token if HMAC secret not configured"
    rationale: "Supports gradual migration to HMAC verification"
metrics:
  duration: 115s
  completed: 2026-02-01
---

# Phase 01 Plan 04: GROW Webhook Security Summary

Secured the GROW webhook endpoint with HMAC signature verification and Zod payload validation with safe number parsing.

## What Was Built

### 1. Webhook Validation Schema (`src/lib/validations/webhook.ts`)

Created Zod schemas for GROW webhook payloads with safe number transforms:

```typescript
// Safe number parsing helpers
export function safeParseInt(value: string, defaultValue: number = 0): number
export function safeParseFloat(value: string): number | null

// Schema with transforms
export const growWebhookSchema = z.object({
  err: z.string(),
  status: z.string(),
  data: z.object({
    // ... string fields
    paymentsNum: z.string().transform((val) => safeParseInt(val, 1)),
    allPaymentsNum: z.string().transform((val) => safeParseInt(val, 1)),
    firstPaymentSum: z.string().transform((val) => safeParseFloat(val)),
    periodicalPaymentSum: z.string().transform((val) => safeParseFloat(val)),
    // ...
  }),
});
```

### 2. Secured Webhook Endpoint (`src/app/api/webhooks/grow/route.ts`)

Updated the webhook endpoint with:

- **Signature verification**: HMAC-SHA256 via `verifyGrowWebhook`
- **Fallback verification**: Process token validation if no HMAC secret
- **Zod validation**: `growWebhookSchema.safeParse` for payload validation
- **Removed all parseInt/parseFloat**: Now handled by Zod transforms
- **Proper error responses**: 401 for signature failure, 400 for validation failure

Security flow:
1. Read raw body (before JSON parsing)
2. Verify HMAC signature if `GROW_WEBHOOK_SECRET` configured
3. Parse and validate with Zod schema
4. Fall back to process token verification if no HMAC
5. Process validated payment data

## Commits

| Hash | Type | Description |
|------|------|-------------|
| e523f86 | feat | Create webhook validation schema with safe number parsing |
| d5a8014 | feat | Secure webhook endpoint with signature verification and Zod validation |

## Deviations from Plan

None - plan executed exactly as written.

## Security Properties

| Property | Implementation |
|----------|----------------|
| Rejects invalid signatures | Returns 401 if HMAC verification fails |
| Rejects replay attacks | Timestamp validation in `verifyGrowWebhook` (from 01-01) |
| Handles NaN gracefully | Zod transforms with `safeParseInt`/`safeParseFloat` |
| Validates payload structure | Zod schema rejects malformed payloads with 400 |

## Verification Results

```
TypeScript:  PASS (no errors in webhook.ts or route.ts)
ESLint:      PASS (no warnings or errors)
grep verifyGrowWebhook: Found in imports and usage
grep growWebhookSchema.safeParse: Found in validation logic
grep parseInt|parseFloat: No matches (moved to Zod)
```

## Files Changed

| File | Lines | Description |
|------|-------|-------------|
| src/lib/validations/webhook.ts | +120 | New file with Zod schemas and helpers |
| src/app/api/webhooks/grow/route.ts | +116/-12 | Added security verification |

## Next Phase Readiness

Plan 01-04 provides secure webhook handling. Ready for:
- Plan 01-05: API route protection with rate limiting
- Plan 01-06: Additional security hardening
