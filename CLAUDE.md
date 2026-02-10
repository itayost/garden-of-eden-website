# Garden of Eden - Football Academy Website

## Project Overview

Hebrew (RTL) football academy platform built with Next.js 16 (App Router) + Supabase + Vercel.
Three user roles: **trainee**, **trainer**, **admin**. Auth via WhatsApp OTP through Supabase.

Production URL: https://www.edengarden.co.il

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript (strict)
- **Styling**: Tailwind CSS 4, Radix UI primitives, Framer Motion
- **Database**: Supabase (Postgres + Auth + RLS)
- **Hosting**: Vercel
- **Caching**: Upstash Redis (rate limiting)
- **Testing**: Vitest + React Testing Library (jsdom)
- **Forms**: React Hook Form + Zod validation

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (watch mode)
npm run test:run     # Vitest (single run)
npx tsc --noEmit     # Type check
```

### Deploy
```bash
vercel                # Preview deployment
vercel --prod         # Production deployment
```

### Database
```bash
supabase db push     # Push migrations to Supabase
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin dashboard (users, assessments, nutrition, videos, shifts, submissions, stats, end-of-shift)
│   ├── dashboard/          # Trainee dashboard pages
│   ├── auth/               # Auth flow (OTP login)
│   ├── onboarding/         # New user onboarding
│   └── api/                # API routes (cron, images, payments, webhooks)
├── components/
│   ├── ui/                 # Shared UI primitives (shadcn/ui based)
│   ├── admin/              # Admin-specific components (tables, forms, toolbars)
│   ├── dashboard/          # Dashboard components
│   ├── landing/            # Landing page sections
│   ├── forms/              # Pre/post workout forms
│   └── auth/               # Auth components
├── features/               # Feature modules (self-contained)
│   ├── achievements/
│   ├── assessment-comparison/
│   ├── form-drafts/
│   ├── goals/
│   ├── nutrition/
│   ├── progress-charts/
│   ├── rankings/
│   └── streak-tracking/
├── hooks/                  # Shared React hooks
├── lib/
│   ├── actions/            # Server Actions ("use server")
│   ├── supabase/           # Supabase clients (see Gotchas below)
│   ├── validations/        # Zod schemas
│   ├── utils/              # Utility functions
│   └── api/                # Auth, storage, and image-validation helpers
├── middleware.ts            # Supabase session refresh + route protection
└── types/                  # TypeScript type definitions
```

## Key Conventions

### Language & RTL
- The app is in **Hebrew** with RTL layout (`dir="rtl"` on `<html>`)
- All user-facing text must be in Hebrew
- Use logical CSS properties when possible (start/end instead of left/right)

### Path Alias
- Use `@/` for imports (maps to `src/`): `import { Button } from "@/components/ui/button"`

### Server Actions
- All server actions use `"use server"` directive
- Admin-only actions call `verifyAdmin()` from `src/lib/actions/shared/`
- Trainer-accessible actions call `verifyAdminOrTrainer()` from the same module — returns discriminated union `{ error, user, profile }`; after early-return on `error`, use `user!` for TS narrowing
- Feature actions accessing user data call `verifyUserAccess(userId)` from `src/lib/actions/shared/`
- Actions live in `src/lib/actions/` or inside `src/features/<name>/lib/actions/`
- Large action files are split into focused files (e.g., `admin-users-create.ts`, `admin-users-update.ts`) with a barrel re-export in the original file

### Feature Modules
- Self-contained features go in `src/features/<name>/`
- Each feature has its own `lib/actions/`, components, and types
- Shared features stay in `src/lib/` and `src/components/`

### Database
- Supabase with Row Level Security (RLS) on all tables
- Migrations in `supabase/migrations/` — two formats coexist:
  - Legacy: `002_player_stats.sql`, `003_player_assessments.sql`
  - Current: `20260201131812_description.sql` (Supabase timestamp format)
- Three Supabase client helpers (all named `createClient` or `createAdminClient`):
  - `createClient()` from `lib/supabase/client.ts` — browser client
  - `createClient()` from `lib/supabase/server.ts` — server components/actions (uses cookies)
  - `createAdminClient()` from `lib/supabase/admin.ts` — service role, bypasses RLS
- DB helper utilities in `lib/supabase/helpers.ts`: `insertIntoTable`, `insertAndSelect`, `updateInTable`, `upsertIntoTable`
- `typedFrom(supabase, "table_name")` from `lib/supabase/helpers.ts` — use instead of `(supabase as any).from()` for tables not in generated types
- Supabase Storage: `avatars` bucket (public) stores all uploads — avatars, meal plan PDFs, etc. Path pattern: `{userId}/{type}/{timestamp}.{ext}`

### Components
- UI primitives based on shadcn/ui (Radix + Tailwind)
- Use `sonner` for toast notifications
- Mobile-first responsive design with bottom nav for mobile
- Reusable `DeleteConfirmDialog` in `src/components/admin/` — use for all delete confirmations
- Reusable `TablePagination` in `src/components/admin/` — use for all paginated tables
- Reusable `TableToolbar` in `src/components/admin/TableToolbar.tsx` — shared search + filter toolbar with composable sub-components (`ToolbarSelect`, `ToolbarCheckbox`, `ToolbarDateRange`). Parent owns state, toolbar handles debounce.
- Shared `useCSVExport` hook in `src/hooks/` — use for CSV export buttons
- Shared `useFormSubmission` hook in `src/hooks/` — handles form submit state and error handling
- Shared `useIsMobile` / `useMediaQuery` hooks in `src/hooks/` — responsive breakpoint detection

### Shared Utilities
- `calculatePercentile()` from `src/lib/utils/math.ts` — shared stats calculation
- `calculateUserRatings()` from `src/lib/utils/calculate-user-ratings.ts` — dashboard rating computation

### Commits
- Follow conventional commits: `feat(scope):`, `fix(scope):`, `refactor(scope):`
- Keep scope to the feature area (auth, admin, mobile, nutrition, etc.)

### Security
- Never expose Supabase service role key to the client
- All admin endpoints must verify role before proceeding
- Rate limiting via Upstash Redis on sensitive endpoints
- File upload API routes follow pattern in `src/app/api/images/` — FormData, auth check, rate limit, validate, upload via `uploadToStorage()`, return URL
- Security headers configured in `next.config.ts` (X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy)
- Startup env validation in `src/lib/env.ts` (called via `src/instrumentation.ts`)
- UUID validation via `isValidUUID()` from `src/lib/validations/common.ts` — use on all action params that accept IDs
- Do not edit `.env.local` files

## Environment Variables

Required in `.env.local` (see `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase anon key (public)
SUPABASE_SERVICE_ROLE_KEY      # Supabase service role (server only!)
NEXT_PUBLIC_SITE_URL           # Site URL for auth callbacks
GROW_USER_ID                   # Meshulam payment gateway
GROW_PAGE_CODE                 # Meshulam page code
GROW_API_URL                   # Meshulam API endpoint
GROW_WEBHOOK_SECRET            # HMAC-SHA256 signature verification for webhooks
GROW_PROCESS_TOKEN             # Fallback token for webhook verification
REMOVEBG_API_KEY               # Remove.bg for FIFA card processing
UPSTASH_REDIS_REST_URL         # Upstash Redis for rate limiting
UPSTASH_REDIS_REST_TOKEN       # Upstash Redis token
CRON_SECRET                    # Protects /api/cron/* endpoints
```

## Gotchas

- **Supabase client import ambiguity**: Both `client.ts` and `server.ts` export `createClient()`. Always import from the correct file — use `lib/supabase/server` in server components/actions, `lib/supabase/client` in client components. Getting this wrong causes cryptic cookie errors.
- **RTL layout**: CSS `left`/`right` are swapped. Use logical properties (`start`/`end`) or test manually. Framer Motion animations may need direction adjustment.
- **Migration numbering**: Older migrations use `001_` prefix, newer ones use Supabase timestamp format. Both work — don't renumber old ones.
- **`"use client"` boundary**: Radix UI components require client-side rendering. If a page only needs a small interactive part, extract it into a client component and keep the page as a server component.
- **Testing**: No mock-based tests — the project has real data in Supabase. Existing tests cover pure utility functions only (validations, ranking-utils, webhook-security).
- **Nutrition meal plans**: `trainee_meal_plans` table supports PDF upload (`pdf_url`, `pdf_path` columns). The old JSONB `meal_plan` column is nullable and unused for new entries.

## Claude Code Automations

### Hooks (`.claude/settings.json`)
- **PreToolUse**: Blocks editing `.env*` files (exit code 2)
- **PostToolUse**: Auto-runs ESLint fix on `.ts/.tsx/.js/.jsx/.mjs` files after edit
- **PostToolUse**: Runs `tsc --noEmit` type-check on `.ts/.tsx` files after edit

### Skills
- `/deploy` — Type-check, build, and deploy to Vercel production
- `/migration` — Create and apply a Supabase migration with RLS validation

### Agents
- `code-reviewer` — Reviews for security (RLS, auth), TypeScript errors, and convention violations
- `security-reviewer` — Deep security audit: RLS gaps, auth verification, service-role exposure, webhook security
