# External Integrations

**Analysis Date:** 2026-02-01

## APIs & External Services

**Payment Processing:**
- GROW (Meshulam) Payment Gateway - Israeli payment processor for credit card and direct debit payments
  - SDK/Client: Custom client in `src/lib/grow/client.ts`
  - Endpoints: `https://sandbox.meshulam.co.il/api/light/server/1.0` (sandbox) and production endpoint
  - Methods:
    - `createPaymentProcess()` - Initiates payment and returns payment URL
    - `approveTransaction()` - Approves transaction after webhook receipt
  - Auth: `GROW_USER_ID`, `GROW_PAGE_CODE`, `GROW_PAGE_CODE_RECURRING` (credentials stored in env)
  - Supports: One-time payments and recurring payments (הוראת קבע)
  - Implementation: `src/app/api/payments/create/route.ts`

**Public Transportation Directions:**
- Moovit - Navigation app integration for public transportation directions
  - Integration: Links in Contact section pointing to Moovit with destination preset
  - Auth: None required (URL-based integration)

## Data Storage

**Primary Database:**
- Supabase (PostgreSQL-based)
  - Provider: Supabase
  - Connection: Via `@supabase/supabase-js` 2.89.0 and `@supabase/ssr` 0.8.0
  - Client-side client: `src/lib/supabase/client.ts` (uses `createBrowserClient`)
  - Server-side client: `src/lib/supabase/server.ts` (uses `createServerClient` with cookie-based auth)
  - Admin client: `src/lib/supabase/admin.ts` (uses service role key, bypasses RLS)
  - Connection env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

**Database Tables:**
- `profiles` - User profile data (role, phone, birthdate, position, avatar)
- `payments` - Payment records (GROW process tracking, transaction details, status)
- Additional tables: form submissions, assessments, activity logs, player stats (inferred from types)
- Type definitions: `src/types/database.ts` (generated from Supabase schema)

**File Storage:**
- Method: Supabase Storage (integrated with Supabase)
- Avatar URLs stored in `profiles.avatar_url`

**Caching:**
- None configured (relying on Next.js default caching and Supabase response caching)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in)
  - Implementation: OTP (One-Time Password) via email or SMS
  - Methods:
    - Email OTP: `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`
    - Phone OTP: `supabase.auth.signInWithOtp({ phone })`
  - Sessions: Managed via cookies (server-side sync in middleware)
  - User roles: "trainee", "trainer", "admin" (stored in `profiles.role`)

**Session Management:**
- Method: Cookie-based with Supabase SSR
- Middleware: `src/middleware.ts` calls `updateSession()` from `src/lib/supabase/middleware.ts`
- Session updates on every request to refresh token validity
- Redirect URLs validated via `src/lib/utils/redirect.ts`

**Protected Routes:**
- `/dashboard/*` - Trainee/trainer dashboard
- `/admin/*` - Admin-only routes
- `/auth/verify` - Email/phone verification (requires sessionStorage from login flow)
- Public routes: `/`, `/auth/login`, `/privacy-policy`, `/terms-of-service`

## Monitoring & Observability

**Error Tracking:**
- None configured (logging to console only)
- Firebase debug log present (`firebase-debug.log`) but Firebase not integrated in code

**Logs:**
- Console logging: Error and info logs to `console.log()` and `console.error()`
- Payment/GROW integration logs: Prefixed with `[Payment]`, `[GROW Webhook]`, `[GROW]`
- Webhook payloads logged with `JSON.stringify()` for debugging
- No structured logging or external log aggregation

## CI/CD & Deployment

**Hosting:**
- Vercel (primary deployment platform)
- `.vercel` directory present for Vercel configuration
- Supports preview deployments and production

**CI Pipeline:**
- Not explicitly configured (likely using Vercel's built-in CI)
- ESLint configured but no explicit test running in CI

**Environment Configuration:**
- Vercel environment variables for production/preview
- Uses `VERCEL_URL` for dynamic base URL determination in webhooks
- Node.js version managed via `.nvmrc` or Vercel defaults

## Webhooks & Callbacks

**Incoming:**
- GROW Payment Webhooks: `POST /api/webhooks/grow`
  - Receives: Payment status notifications from GROW/Meshulam
  - Processes: Updates payment records in Supabase with transaction details
  - Responds: Returns `{ success: true }` on success
  - Implementation: `src/app/api/webhooks/grow/route.ts`

**Outgoing:**
- Payment Callbacks (success/cancel): Handled via redirect URLs provided to GROW
  - Success URL: `${baseUrl}/?payment=success`
  - Cancel URL: `${baseUrl}/?payment=cancelled`
  - Base URL determined by: `NEXT_PUBLIC_SITE_URL` (production) or `VERCEL_URL` (preview) or fallback

**Webhook Signature Verification:**
- Not implemented - GROW webhooks trusted but not verified via signature
- Uses `process_id` and `process_token` matching for additional validation

## Authentication Flow

**User Registration:**
1. User submits email or phone at `/auth/login`
2. Supabase sends OTP via email/SMS
3. User verifies OTP at `/auth/verify`
4. Supabase creates session and user account (if using email with `shouldCreateUser: true`)
5. Session persisted via cookies
6. Middleware syncs session on each request
7. User profile created/completed at `/onboarding/profile`

**Protected Route Access:**
- Checked at layout/page level via `createClient()` calls
- `src/app/dashboard/layout.tsx` - Dashboard access
- `src/app/admin/layout.tsx` - Admin access
- Redirect to `/auth/login` if not authenticated

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (server-only)
- `GROW_USER_ID` - GROW account user ID
- `GROW_PAGE_CODE` - GROW page code for one-time payments
- `GROW_PAGE_CODE_RECURRING` - GROW page code for recurring (optional, but required if supporting recurring)
- `GROW_API_URL` - GROW API endpoint (optional, defaults to sandbox)

**Secrets location:**
- `.env.local` (local development, git-ignored)
- Vercel Environment Variables (production/preview)
- Reference template: `.env.local.example`

## API Route Organization

**Payment Routes:**
- `POST /api/payments/create` - Create new payment process, validate payer details, integrate with GROW

**Webhook Routes:**
- `POST /api/webhooks/grow` - Receive payment status updates from GROW
- `GET /api/webhooks/grow` - Health check endpoint

**Payment Flow:**
1. Frontend submits payment request to `POST /api/payments/create`
2. Backend validates payer details (phone format, name)
3. Backend calls GROW API to create payment process
4. GROW returns payment URL and process ID
5. Backend stores payment record in Supabase (with admin client to bypass RLS)
6. Backend returns payment URL to frontend
7. Frontend redirects user to GROW payment page
8. User completes payment on GROW page
9. GROW sends webhook to `POST /api/webhooks/grow` with transaction details
10. Webhook handler updates payment record with transaction status
11. Webhook handler calls GROW API to approve transaction
12. User redirected back via success/cancel URL

---

*Integration audit: 2026-02-01*
