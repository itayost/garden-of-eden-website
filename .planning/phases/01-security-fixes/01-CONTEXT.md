# Phase 1: Security Fixes - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden APIs, webhooks, and database against security vulnerabilities before launch. Add rate limiting, webhook signature verification, input validation with Zod, and RLS policies. Infrastructure-focused — no new user features.

</domain>

<decisions>
## Implementation Decisions

### Error Responses
- Rate limit errors: Minimal/vague message ("Request failed. Please try again later.") — do NOT reveal it's rate limiting
- Validation errors: Field-level inline — show errors next to each invalid field in forms
- Error language: Hebrew for user-facing errors, English for technical logs

### Rate Limit Thresholds
- Payment endpoint (`/api/payments/create`): 10 attempts per hour per user
- General API routes: 100 requests per minute
- Limit scope: Per-user when authenticated, per-IP for anonymous requests
- Admin exemption: Admins bypass rate limits entirely

### Soft Delete Behavior
- Retention: Indefinite — never hard delete, mark with `deleted_at` timestamp
- Admin visibility: Hidden by default, recovery only via direct database access
- Cascade: When user is soft-deleted, all their data (assessments, forms, goals) is also soft-deleted
- Self-delete: Admin-only — users cannot delete their own accounts

### Claude's Discretion
- Webhook error logging detail level (balance security vs debuggability)
- Rate limiting middleware implementation (upstash vs in-memory vs middleware)
- Specific Zod schema structure for each endpoint
- RLS policy specifics for UPDATE/DELETE operations

</decisions>

<specifics>
## Specific Ideas

- Error messages should not reveal security mechanisms (don't say "rate limited", just "try again")
- This is an Israeli app — user-facing content in Hebrew, dev content in English
- Data preservation is priority — soft delete everything, never lose data

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-security-fixes*
*Context gathered: 2026-02-01*
