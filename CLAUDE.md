# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Hebrew (RTL) football academy platform. Manages trainees, trainers, and admin operations with assessments, progress tracking, nutrition plans, shift management, and workout submissions.

Production: <https://www.edengarden.co.il>

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Supabase** (Postgres + Auth + RLS) — WhatsApp OTP auth, three roles: trainee/trainer/admin
- **Tailwind CSS 4** + **Radix UI** (shadcn/ui based) + **Framer Motion**
- **Vercel** hosting, **Upstash Redis** for rate limiting
- **Meshulam** (Grow) payment gateway
- **Vitest** + React Testing Library (jsdom), **Playwright** for E2E
- **React Hook Form** + **Zod** validation

## Critical Rules

### 1. Code Organization

- Many small files over few large files (200-400 lines typical, 800 max)
- Organize by feature/domain: self-contained modules go in `src/features/<name>/`
- Shared code stays in `src/lib/` and `src/components/`
- Split large action files into focused files with a barrel re-export (e.g., `admin-users-create.ts`, `admin-users-update.ts` re-exported from `admin-users.ts`)

### 2. Code Style

- No emojis in code, comments, or docs
- Immutability always — never mutate objects or arrays
- All user-facing text in **Hebrew**, `dir="rtl"` on `<html>`
- Use logical CSS properties (`start`/`end`) instead of `left`/`right`
- Path alias: `@/` maps to `src/`

### 3. Security

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- Admin actions call `verifyAdmin()`; trainer-accessible actions call `verifyAdminOrTrainer()`; user-scoped actions call `verifyUserAccess(userId)` — all from `src/lib/actions/shared/`
- Validate all IDs with `isValidUUID()` from `src/lib/validations/common.ts`
- Validate timestamps, ordering, durations server-side — never trust client validation alone
- Rate-limit sensitive endpoints via Upstash Redis
- Do not edit `.env.local` files (blocked by PreToolUse hook)

### 4. Testing

- No mock-based tests — the project uses real Supabase data
- Tests cover pure utility functions only (validations, ranking-utils, webhook-security)
- Write tests first for new utility functions

## Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint
npm run test             # Vitest (watch mode)
npm run test:run         # Vitest (single run)
npm run test:coverage    # Vitest with coverage
npm run test:e2e         # Playwright E2E
npm run test:e2e:ui      # Playwright UI mode
npx tsc --noEmit         # Type check
```

### Deploy & Database

```bash
vercel                  # Preview deployment
vercel --prod           # Production deployment
supabase db push        # Push migrations to Supabase
```

### Run a single test

```bash
npm run test:run -- path/to/file.test.ts      # Single file
npm run test:run -- -t "test name pattern"    # By name
```

## Architecture

### Auth & Role Verification

Middleware (`src/middleware.ts`) refreshes Supabase sessions and gates routes. Server actions guard access via shared verify functions that return a discriminated union `{ error, user, profile }` — early-return on `error`, then use `user!` for TS narrowing.

### Server Actions

All actions use `"use server"` and live in `src/lib/actions/` or `src/features/<name>/lib/actions/`. Input validation uses Zod schemas from `src/lib/validations/`.

### Supabase Clients (three variants — pick carefully)

- `createClient()` from `lib/supabase/client.ts` — **browser** client
- `createClient()` from `lib/supabase/server.ts` — **server** components/actions (uses cookies)
- `createAdminClient()` from `lib/supabase/admin.ts` — **service role**, bypasses RLS

DB helpers in `lib/supabase/helpers.ts`: `insertIntoTable`, `insertAndSelect`, `updateInTable`, `upsertIntoTable`. Use `typedFrom(supabase, "table_name")` instead of `(supabase as any).from()` for tables missing from generated types.

### Storage

Single public bucket `avatars` stores avatars, meal plan PDFs, and other uploads. Path pattern: `{userId}/{type}/{timestamp}.{ext}`. File upload API routes follow the pattern in `src/app/api/images/` — FormData → auth check → rate limit → validate → `uploadToStorage()` → return URL.

### Shared Admin Components (reuse — don't recreate)

- `DeleteConfirmDialog` — standard delete confirmation
- `TablePagination` — paginated table footer
- `TableToolbar` with `ToolbarSelect`/`ToolbarCheckbox`/`ToolbarDateRange` — search + filter toolbar, parent owns state, toolbar handles debounce
- CSV exports in `src/components/admin/exports/` — Hebrew headers, BOM, Papa.unparse

### Shared Hooks & Utilities

- `useFormSubmission` — form submit state + error handling
- `useIsMobile` / `useMediaQuery` — responsive breakpoints
- `calculatePercentile()` from `lib/utils/math.ts` — shared stats
- `calculateUserRatings()` from `lib/utils/calculate-user-ratings.ts` — dashboard ratings

### API Response & Error Handling

```ts
try {
  const result = await operation()
  return { success: true, data: result }
} catch (error) {
  console.error('Operation failed:', error)
  return { success: false, error: 'User-friendly Hebrew message' }
}
```

### Migrations

Two formats coexist in `supabase/migrations/`:

- Legacy: `002_player_stats.sql`
- Current: `20260201131812_description.sql` (Supabase timestamp format)

Both work — don't renumber old ones.

## Gotchas

- **Supabase client import ambiguity**: Both `client.ts` and `server.ts` export `createClient()`. Wrong import = cryptic cookie errors. Double-check when moving code between client/server.
- **RLS silently rejects admin-on-behalf-of inserts**: Existing INSERT policies usually require `auth.uid() = owner_id`. When an admin inserts a row for *another* user (e.g., shift for trainer), you need a separate admin INSERT policy — otherwise the insert fails silently.
- **`.update().eq()` on nonexistent rows**: Returns no error, updates zero rows. Pre-check existence with `.maybeSingle()` if the action reports "not found".
- **Dialog edit state staleness**: `useState(prop)` only runs on mount. For edit dialogs receiving different data via props, pass `key={item.id}` to force remount.
- **`"use client"` boundaries**: Radix components require client rendering. Extract small interactive parts into client components and keep pages as server components when possible.
- **RTL in Framer Motion**: `x` translations and CSS `left`/`right` are mirrored. Test both directions.
- **Nutrition meal plans**: `trainee_meal_plans` uses PDF upload (`pdf_url`, `pdf_path`). The legacy JSONB `meal_plan` column is unused for new entries.
- **DB trigger auto-creates profiles**: `on_auth_user_created` runs on `auth.users` insert — don't manually insert into `profiles` after `auth.admin.createUser()`.

## Environment Variables

See `.env.local.example`. Required:

```text
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL
GROW_USER_ID, GROW_PAGE_CODE, GROW_API_URL, GROW_WEBHOOK_SECRET, GROW_PROCESS_TOKEN
REMOVEBG_API_KEY
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
CRON_SECRET
```

Startup validation in `src/lib/env.ts` (called via `src/instrumentation.ts`) fails fast if any required var is missing.

## Claude Code Automations

### Hooks (`.claude/settings.json`)

- **PreToolUse**: Blocks editing `.env*` files (exit code 2)
- **PostToolUse**: Auto-runs ESLint fix on edited JS/TS files
- **PostToolUse**: Runs `tsc --noEmit` type-check on edited `.ts/.tsx`

### Skills

- `/deploy` — Type-check, build, and deploy to Vercel production
- `/migration` — Create and apply a Supabase migration with RLS validation

### Agents

- `code-reviewer` — Security (RLS, auth), TypeScript errors, convention violations
- `security-reviewer` — Deep security audit: RLS gaps, auth verification, service-role exposure, webhook security

## Git Workflow

Conventional commits with feature scope: `feat(auth):`, `fix(admin):`, `refactor(nutrition):`. Keep scope to the feature area (auth, admin, mobile, nutrition, shifts, etc.).
