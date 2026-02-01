# Project State: Garden of Eden

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** Trainees can track their fitness progress and see improvement as FIFA-style player cards
**Current focus:** Phase 2 - Admin User Management

## Current Position

| Metric | Value |
|--------|-------|
| Current Phase | 2 of 10 (User Management) |
| Current Plan | 2/7 complete |
| Phase Status | In progress |
| Requirements Complete | 5/57 (SEC-01 to SEC-05) |
| Overall Progress | 14% |

**Progress:** [##........] 2/7 plans in Phase 2

## Phase Overview

| Phase | Name | Status | Requirements |
|-------|------|--------|--------------|
| 1 | Security Fixes | Complete | SEC-01 to SEC-05 |
| 2 | User Management | In Progress | ADMN-06 to ADMN-13 |
| 3 | Video Management | Pending | VID-02 to VID-09 |
| 4 | Data Export & Assessments | Pending | EXP-01 to EXP-04, ASMT-04 |
| 5 | Profile & Settings | Pending | PROF-01 to PROF-07 |
| 6 | Auth Enhancements | Pending | AUTH-05 to AUTH-09 |
| 7 | Notifications | Pending | NOTF-01 to NOTF-08 |
| 8 | Form Drafts Sync | Pending | FORM-03 to FORM-06 |
| 9 | Testing & Quality | Pending | TEST-01 to TEST-06 |
| 10 | Performance | Pending | PERF-01 to PERF-06 |

## Accumulated Decisions

| Date | Phase-Plan | Decision | Rationale |
|------|------------|----------|-----------|
| 2026-02-01 | 01-01 | Fail-open rate limiting | Prefer availability over blocking legitimate users when Redis unavailable |
| 2026-02-01 | 01-01 | Process token fallback for GROW | Uncertain HMAC signature format, added alternative verification |
| 2026-02-01 | 01-01 | 5-minute replay protection | Balance security vs clock drift tolerance |
| 2026-02-01 | 01-02 | Soft delete over hard delete | Preserves data for audit trail and allows recovery |
| 2026-02-01 | 01-02 | Partial unique indexes | Allows recreation of accounts with same phone after soft delete |
| 2026-02-01 | 01-02 | Forms as immutable audit logs | INSERT-only for pre_workout, post_workout, nutrition forms |
| 2026-02-01 | 01-02 | Activity logs append-only | No UPDATE/DELETE for audit integrity |
| 2026-02-01 | 01-02 | Admin visibility includes deleted | Admins can see soft-deleted records for support |
| 2026-02-01 | 01-03 | Vague rate limit message | Don't reveal rate limiting mechanism in error messages |
| 2026-02-01 | 01-03 | Field-level errors format | Return fieldErrors object for form integration |
| 2026-02-01 | 01-03 | Rate limit before parsing | Check rate limit immediately before processing payload |
| 2026-02-01 | 01-04 | Graceful NaN handling | Default to 1 for paymentsNum, null for payment sums |
| 2026-02-01 | 01-04 | Signature fallback | Fall back to process token if HMAC secret not configured |
| 2026-02-01 | 01-05b | Keep Promise.all type casts | Required due to Supabase client type inference limitations |
| 2026-02-01 | 01-05 | Retain `as unknown as` patterns | TypeScript requires unknown for incompatible type assertions |
| 2026-02-01 | 01-06 | Skip Redis-dependent tests | Focus on unit-testable helpers, skip checkRateLimit |
| 2026-02-01 | 01-06 | Use Vitest fake timers | For timestamp validation in replay attack tests |
| 2026-02-01 | 02-01 | Phone normalization in server action | Format 0XX to +972XX at action level, not schema |
| 2026-02-01 | 02-01 | Profile update not insert | DB trigger creates profile, use update to avoid race |
| 2026-02-01 | 02-01 | Phone-only credential reset | Return message for OTP login, no SMS delivery |

## Patterns Established

| Pattern | Description | Source |
|---------|-------------|--------|
| Rate limit identifier | userId for authenticated, ip:address for anonymous | 01-01 |
| Webhook HMAC payload | timestamp.body format | 01-01 |
| Admin exemption | Admin role bypasses rate limits | 01-01 |
| Soft delete | Use `deleted_at TIMESTAMPTZ` column, NULL = active | 01-02 |
| Admin check in RLS | `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')` | 01-02 |
| Session user in RLS | Use `(SELECT auth.uid())` for current user | 01-02 |
| Payment validation | Full name requires 2+ words with 2+ chars each | 01-03 |
| Rate limit response | Hebrew "הבקשה נכשלה. נסה שוב מאוחר יותר" | 01-03 |
| Validation error format | `{ error: string, fieldErrors: Record<string, string> }` | 01-03 |
| Zod transforms for numbers | Use z.transform with safeParseInt/safeParseFloat | 01-04 |
| Webhook raw body first | Read request.text() before JSON parsing for signature | 01-04 |
| Const arrays for Zod enums | Use `as const` for arrays passed to z.enum() | 01-05b |
| PostgrestVersion hint | Add `__InternalSupabase.PostgrestVersion` to Database type | 01-05b |
| Test file location | src/lib/__tests__/ for lib modules, src/lib/validations/__tests__/ for validations | 01-06 |
| Test naming convention | 'should [expected behavior]' with describe blocks per function | 01-06 |
| verifyAdmin helper | Centralized admin role check for server actions | 02-01 |
| ActionResult type | `{ success: true }` or `{ error: string, fieldErrors? }` | 02-01 |
| UUID validation | Regex check before database operations | 02-01 |
| Admin form + server action | Client form calls server action, sets field errors via setError() | 02-02 |
| Admin page role check | Server component verifies admin role before render | 02-02 |

## Blockers / Concerns

| Issue | Impact | Resolution |
|-------|--------|------------|
| Migration 01-02 not applied | RLS policies not active in database | Apply via Supabase Dashboard SQL Editor |
| Test file null checks | 11 TypeScript errors in ranking-utils.test.ts | Pre-existing, not blocking |

## Workflow Configuration

- **Mode:** Interactive (confirm at each step)
- **Parallelization:** Enabled
- **Research:** Enabled (before each phase)
- **Plan Check:** Enabled (verify plans)
- **Verifier:** Enabled (after each phase)
- **Model Profile:** Quality (Opus for research/roadmap)

## Session Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-01 | Project initialized | Brownfield project with existing codebase |
| 2026-02-01 | Roadmap created | 10 phases, 145 tasks, 57 requirements |
| 2026-02-01 | 01-01 complete | Security infrastructure utilities created |
| 2026-02-01 | 01-02 complete | Security indexes, soft delete, 38 RLS policies |
| 2026-02-01 | 01-03 complete | Payment rate limiting and Zod validation |
| 2026-02-01 | 01-04 complete | Webhook signature verification and Zod validation |
| 2026-02-01 | 01-05b complete | Type safety improvements, Zod enum fix, PostgrestVersion |
| 2026-02-01 | 01-05 complete | Added deleted_at to types; `as unknown as` retained per 01-05b decision |
| 2026-02-01 | 01-06 complete | 105 tests for security features (rate limit, webhook, validation) |
| 2026-02-01 | 02-01 complete | Server actions for admin user CRUD, Phase 2 dependencies |
| 2026-02-01 | 02-02 complete | User creation form and page at /admin/users/create |

## Session Continuity

- **Last session:** 2026-02-01T13:06:00Z
- **Stopped at:** Completed 02-02-PLAN.md
- **Resume file:** None

## Next Action

Continue Phase 2: Execute 02-03-PLAN.md (User Data Table with TanStack Table)

---
*Last updated: 2026-02-01T13:06:00Z*
