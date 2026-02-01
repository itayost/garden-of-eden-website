# Codebase Concerns

**Analysis Date:** 2026-02-01

## Security Considerations

**sessionStorage Usage for Auth State:**
- Risk: Authentication state (email, phone, verification type) stored in sessionStorage can be accessed by any JavaScript running on the page, including XSS attacks
- Files: `src/app/auth/login/page.tsx`, `src/app/auth/verify/page.tsx`
- Current mitigation: sessionStorage is cleared after auth completion, but data persists during auth flow
- Recommendations: Consider using httpOnly cookies for sensitive auth data; implement CSRF tokens for auth endpoints; add content security policy headers

**dangerouslySetInnerHTML in Chart Component:**
- Risk: Dynamic style injection via `dangerouslySetInnerHTML` in chart configuration. While currently only using config values, any future changes allowing user input could enable CSS injection
- Files: `src/components/ui/chart.tsx` (line 83)
- Current mitigation: Only injecting CSS variable values from known config objects
- Recommendations: Validate all config values; consider using CSS-in-JS instead of style injection; add strict CSP rules for style-src

**Payment Webhook Authentication:**
- Risk: Webhook endpoint `/api/webhooks/grow` validates payload structure but does not authenticate webhook source (no signature verification against GROW)
- Files: `src/app/api/webhooks/grow/route.ts`
- Current mitigation: Basic payload structure validation (status !== "1" check)
- Recommendations: Implement HMAC signature verification for GROW webhooks; rate limit webhook endpoint; add request source validation

**Unauthenticated Payment Endpoint:**
- Risk: Payment creation endpoint `/api/payments/create` explicitly does not require authentication - anyone can create payment records
- Files: `src/app/api/payments/create/route.ts`
- Current mitigation: Server-side validation of amount, name, phone; uses admin client to bypass RLS
- Recommendations: Implement rate limiting; consider adding CAPTCHA for anonymous payments; log all payment creations for fraud detection

**Credentials Not Rotated for GROW Integration:**
- Risk: GROW_USER_ID, GROW_PAGE_CODE stored in environment variables; no credential rotation mechanism evident
- Files: `.env.local` (configuration), `src/lib/grow/client.ts` (usage)
- Current mitigation: Stored in environment only
- Recommendations: Implement credential rotation schedule; use key management service; audit GROW API access logs regularly

---

## Performance Bottlenecks

**Large Page Components Exceeding Recommended Sizes:**
- Problem: Multiple page components are over 450 lines, indicating complex logic that should be decomposed
- Files affected:
  - `src/app/admin/submissions/[formType]/[formId]/page.tsx` (547 lines)
  - `src/app/dashboard/assessments/page.tsx` (481 lines)
  - `src/app/dashboard/forms/nutrition/page.tsx` (459 lines)
  - `src/app/dashboard/forms/pre-workout/page.tsx` (318 lines)
- Impact: Hard to test, understand, and maintain; potential memory issues on large datasets
- Improvement path: Extract submission detail display logic into separate components; move form rendering into dedicated feature modules

**No Pagination on Large Data Queries:**
- Problem: Activity logs, form submissions, and assessments are fetched without pagination
- Files: `src/features/rankings/lib/actions/get-rankings.ts`, form submission pages
- Impact: Can cause rendering slowdowns and memory issues as data grows
- Improvement path: Implement cursor-based pagination; add limit/offset to database queries; lazy load data on scroll

**Console Logging in Production:**
- Problem: `console.log` and `console.error` statements throughout codebase remain in production, adding overhead
- Files affected (40+ instances): `src/lib/grow/client.ts`, `src/app/api/webhooks/grow/route.ts`, `src/components/payments/PaymentFormModal.tsx`, and more
- Impact: Performance degradation on high-traffic endpoints; sensitive data exposure in browser logs
- Improvement path: Implement centralized logging service; strip console calls in production builds; use structured logging

---

## Test Coverage Gaps

**Minimal Test Coverage:**
- What's not tested: 99% of codebase lacks tests; only 2 test files exist
- Files: `src/features/assessment-comparison/__tests__/comparison-utils.test.ts`, `src/features/rankings/__tests__/ranking-utils.test.ts`
- Risk: Auth flows, payment integration, database operations, and complex business logic have no automated validation
- Priority: HIGH - Critical payment and auth flows are untested
- Recommendations: Add tests for payment webhook validation; add auth flow tests; add database operation tests; target 80% coverage

**No E2E Tests:**
- What's not tested: User journeys, form submissions, payment flow
- Risk: Regressions in critical user workflows undetected until production
- Priority: HIGH
- Improvement path: Set up Playwright or Cypress; create tests for auth flow, form submission, payment process

**No Unit Tests for Utilities:**
- What's not tested: Assessment rating calculations, date formatting, form validation
- Files: `src/lib/assessment-to-rating.ts`, `src/lib/validations/forms.ts`, `src/lib/utils/storage.ts`
- Risk: Calculation errors go undetected
- Improvement path: Add unit tests for `assessment-to-rating.ts` transformation logic; test all validation functions

---

## Error Handling

**Inconsistent Error Handling Patterns:**
- Issue: Try-catch blocks swallow errors and only log to console; no structured error reporting
- Files: Most files with try-catch blocks (89 instances across 24 files)
- Pattern: `console.error("...", error)` followed by generic toast message
- Impact: Production errors are invisible to developers; impossible to track recurring issues
- Recommendations: Implement centralized error boundary; use error tracking service (Sentry); create error logger utility

**Silent Failures in Database Updates:**
- Issue: When database updates fail, errors are logged but execution continues
- Files: `src/app/api/webhooks/grow/route.ts` (lines 64-67)
- Pattern: `if (updateError) { console.error(...); /* continue anyway */ }`
- Impact: Payment webhook received but database not updated; data inconsistency
- Improvement path: Return error response if update fails; implement transaction rollback

**Missing Error Context:**
- Issue: Error messages don't include request ID or user context
- Files: All API routes
- Impact: Difficult to debug errors in production
- Improvement path: Add request ID logging; include correlation IDs in error messages

---

## Tech Debt

**Redundant GROW Page Code Configuration:**
- Issue: Two separate page codes (one-time vs recurring) but single env var initially
- Files: `src/lib/grow/client.ts` (lines 9-10)
- Impact: Recurring payments configuration unclear; GROW_PAGE_CODE_RECURRING may not be set
- Fix approach: Document required env vars clearly; add startup validation; consider using single config object

**Type Casting in Database Queries:**
- Issue: Type assertions used to bypass TypeScript in database operations
- Files: `src/app/api/webhooks/grow/route.ts` (lines 58-59, 77-78)
- Pattern: `as ReturnType<typeof supabase.from>` cast to work around type mismatches
- Impact: Loss of type safety; harder to refactor database schema
- Fix approach: Update Supabase types; create typed wrapper functions for database operations

**sessionStorage Dependency:**
- Issue: Auth verification page relies on sessionStorage to retrieve phone/email/type
- Files: `src/app/auth/verify/page.tsx` (lines 27-29)
- Impact: Auth fails if page is reloaded or opened in new tab; poor UX
- Fix approach: Use Supabase session store directly; use URL query parameters with PKCE token

**Missing Rate Limiting:**
- Issue: Payment and auth endpoints have no rate limiting
- Files: `src/app/api/payments/create/route.ts`, `/auth/login`
- Impact: Susceptible to brute force attacks (phone/email OTP) and payment spam
- Fix approach: Implement rate limiting middleware; track attempts by IP/phone/email

**Environment Variables Not Validated at Startup:**
- Issue: GROW credentials missing at runtime cause errors only when endpoint called
- Files: `src/lib/grow/client.ts` (lines 180-183, 241-243)
- Impact: App starts successfully but fails at runtime
- Fix approach: Add startup validation; throw errors during initialization

---

## Fragile Areas

**Payment Integration with GROW:**
- Files: `src/lib/grow/client.ts`, `src/app/api/payments/create/route.ts`, `src/app/api/webhooks/grow/route.ts`
- Why fragile: Relies on external payment gateway with complex webhook flow; custom field mapping (cField1, cField2) is implicit
- Safe modification: Add integration tests; document GROW API contract; add webhook signature verification
- Test coverage: None - webhook handling untested

**Authentication Flow:**
- Files: `src/app/auth/login/page.tsx`, `src/app/auth/verify/page.tsx`, `src/app/auth/callback/route.ts`
- Why fragile: Depends on sessionStorage state; phone formatting logic is fragile (multiple code paths)
- Safe modification: Move to Supabase session management; simplify phone format normalization
- Test coverage: None - critical path untested

**Assessment Rating Calculations:**
- Files: `src/lib/assessment-to-rating.ts` (343 lines)
- Why fragile: Complex business logic with 30+ conditional branches; no unit tests
- Safe modification: Add unit tests for each rating rule; document formulas
- Test coverage: None - calculations untested

---

## Scaling Limits

**No Pagination on Rankings:**
- Current capacity: Loads all user profiles and assessments into memory
- Limit: Will slow significantly with >1000 active users
- Scaling path: Implement database-level ranking calculation; add pagination to rankings page

**Database Connection Pooling:**
- Current capacity: Using Supabase default settings
- Limit: Unknown connection pool size
- Scaling path: Check Supabase connection pool settings; consider adjusting for production load

**No Caching Strategy:**
- Current capacity: Every page load queries database for user data, rankings, assessments
- Limit: Database will be bottleneck with concurrent users
- Scaling path: Implement Redis caching for rankings; cache user profiles; add SWR for client-side caching

---

## Missing Features / Incomplete Implementations

**No User Role-Based Access Control Audit Logging:**
- What's missing: No audit trail for admin actions (who modified what, when)
- Blocks: Compliance requirements; security investigations
- Files affected: `src/app/admin/*` pages
- Fix approach: Create audit log table; log all admin actions to database

**No Payment Reconciliation:**
- What's missing: No mechanism to reconcile GROW payments with database records
- Blocks: Financial audits; fraud detection
- Files affected: `src/app/api/webhooks/grow/route.ts`
- Fix approach: Create reconciliation report; add payment status validation

**Incomplete Email Validation:**
- What's missing: Email login accepts invalid formats (no @ check, minimal validation)
- Files: `src/app/auth/login/page.tsx` (line 77 only checks for @)
- Impact: Supabase may reject OTP requests
- Fix approach: Use proper email validation library; validate before API call

**No Phone Number Validation Library:**
- What's missing: Custom phone formatting logic instead of using library
- Files: `src/app/auth/login/page.tsx` (lines 25-34)
- Impact: May accept invalid Israeli phone numbers; inconsistent formatting
- Fix approach: Use libphonenumber-js library; validate country code

---

## Dependencies at Risk

**Recharts Library with dangerouslySetInnerHTML:**
- Risk: Chart styling uses style injection; potential for CSS-based attacks if user input ever reaches config
- Impact: Chart component could be XSS vector
- Files: `src/components/ui/chart.tsx`
- Migration plan: Monitor recharts updates; replace with safer styling approach; audit all data flowing into chart config

**Supabase Type Sync Issues:**
- Risk: Database types getting out of sync with actual schema; addressed with type casts but brittle
- Impact: Type safety lost; refactoring harder
- Files: Webhook and payment routes
- Migration plan: Implement type generation from Supabase schema; run in CI pipeline

---

## Known Bugs / Edge Cases

**Phone Format Normalization Edge Case:**
- Symptoms: Phone numbers starting with 972 stay as-is; others get 972 prefix; numbers without 05 get default prefix
- Trigger: User enters various phone formats (970123456789, 050-123-4567, 0501234567)
- Files: `src/app/auth/login/page.tsx` (lines 25-34)
- Workaround: Always enter standard Israeli format (050XXXXXXXX)
- Impact: May reject valid international numbers; UX confusion

**Session Storage Lost on Tab Close:**
- Symptoms: Auth verification fails if user closes and reopens browser tab
- Trigger: User starts login, closes tab, opens new tab and tries to complete verification
- Files: `src/app/auth/verify/page.tsx` (sessionStorage dependency)
- Workaround: Complete auth flow in same browser session
- Impact: Poor user experience; forced to restart login

**Webhook Duplicate Processing Risk:**
- Symptoms: Same payment could be processed twice if webhook called multiple times
- Trigger: GROW webhook resends notification on network failure
- Files: `src/app/api/webhooks/grow/route.ts`
- Workaround: None - database will update with latest values
- Impact: Potential duplicate payment records if process_id/token indices not unique

---

*Concerns audit: 2026-02-01*
