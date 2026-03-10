<!-- Generated: 2026-03-10 | Files scanned: 404 | Token estimate: ~700 -->

# Architecture Overview

## System Type
Single Next.js 16 app (App Router) with Supabase backend, deployed on Vercel.
Hebrew RTL football academy platform. Three roles: trainee, trainer, admin.

## High-Level Data Flow

```
Browser (React 19)
  |
  |-- Server Components (read data via Supabase server client)
  |-- Server Actions ("use server" in src/lib/actions/)
  |-- API Routes (src/app/api/)
  |
  v
Middleware (src/middleware.ts)
  -> Supabase session refresh + route protection
  |
  v
Supabase (Postgres + Auth + Storage + RLS)
  |
  +-- Auth: WhatsApp OTP via Supabase Auth
  +-- Storage: avatars bucket (public) - avatars, PDFs, images
  +-- RLS: all tables protected
  |
External Services:
  +-- Vercel (hosting, cron, analytics)
  +-- Upstash Redis (rate limiting)
  +-- Meshulam/Grow (payments + webhooks)
  +-- Remove.bg (FIFA card image processing)
  +-- Arbox (user sync via API)
  +-- WhatsApp Business (flow endpoint)
```

## Auth Flow

```
Login -> WhatsApp OTP -> Supabase Auth -> Session cookie
  -> Middleware refreshes session on each request
  -> Optional 2FA (src/app/auth/verify-2fa/)
  -> New users -> Onboarding (src/app/onboarding/profile/)
  -> DB trigger `on_auth_user_created` auto-creates profile
```

## Role-Based Access

```
/admin/*      -> verifyAdmin() or verifyAdminOrTrainer()
/dashboard/*  -> authenticated trainees (+ trainers with limited views)
/auth/*       -> public
/             -> public landing page
```

## Key Directories

```
src/app/           Pages + API routes (App Router)
src/components/    UI components (admin/, dashboard/, forms/, landing/, ui/)
src/features/      Self-contained feature modules (9 features)
src/lib/actions/   Server Actions (admin-*, trainer-*, user-facing)
src/lib/supabase/  DB clients (client.ts, server.ts, admin.ts, helpers.ts)
src/lib/validations/ Zod schemas per entity
src/hooks/         Shared React hooks
src/types/         TypeScript type definitions
supabase/migrations/ DB migrations (legacy NNN_ + timestamp format)
```
