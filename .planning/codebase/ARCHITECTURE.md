# Architecture

**Analysis Date:** 2026-02-01

## Pattern Overview

**Overall:** Next.js App Router with Server Components and Server Actions, using a modular feature-based architecture with shared utilities and UI component library.

**Key Characteristics:**
- Server-first rendering using Next.js 16.1 with async page components
- Authentication via Supabase with middleware-based route protection
- Modular feature structure with index-based exports (barrel files)
- Dedicated UI component library using shadcn-inspired patterns
- Type-safe Supabase integration with generated database types
- Payment processing via GROW (Meshulam) gateway with webhook handling

## Layers

**Presentation (Components):**
- Purpose: Render UI and handle client-side interactions
- Location: `src/components/`
- Contains: React components split by domain (landing, dashboard, admin, UI components, payments, player-card)
- Depends on: UI primitives, types, utils, features
- Used by: Page components

**Page/Route Layer:**
- Purpose: Server-rendered pages and API endpoints
- Location: `src/app/`
- Contains: Next.js App Router pages (pages.tsx), API routes, and middleware
- Depends on: Components, features, Supabase client, utilities
- Used by: Next.js routing system

**Feature Modules:**
- Purpose: Domain-specific logic grouped by feature area (not global utilities)
- Location: `src/features/`
- Contains: Achievements, goals, rankings, streak-tracking, progress-charts, assessment-comparison, form-drafts
- Structure: Each feature has `components/`, `lib/`, `types/`, `__tests__/`, and `index.ts` barrel export
- Depends on: Database types, validation schemas, UI components, utilities
- Used by: Pages and components

**Data/Business Logic Layer:**
- Purpose: Database access, validation, and business rules
- Location: `src/lib/`
- Contains: Supabase clients, form validations, assessment calculations, payment gateway, utilities
- Modules:
  - `lib/supabase/` - Database clients (server, client, admin, middleware)
  - `lib/validations/` - Zod schemas for forms and data
  - `lib/grow/` - Payment gateway integration
  - `lib/utils/` - Helper functions (profile, storage, UUID, redirect)
  - `lib/assessment-to-rating.ts` - Rating calculation logic
- Used by: Pages, features, and API routes

**Shared Types:**
- Purpose: Type definitions for database, features, and validations
- Location: `src/types/`
- Contains: Database types (auto-generated from Supabase), assessment types, player-stats, activity-log
- Depends on: Supabase schema

## Data Flow

**Page Rendering Flow:**

1. User request → Next.js routing
2. Middleware intercepts request (`src/middleware.ts`)
   - Validates session with Supabase
   - Checks route protection (auth required, role-based access)
   - Redirects to login if unauthorized
   - Checks profile completion status
3. Page component (async server component) executes
   - Creates Supabase client via `createClient()`
   - Fetches data via parallel queries (`Promise.all`)
   - Renders with data or fallback UI
4. Components render (mix of server/client)
   - Server components process data
   - Client components handle interactions
5. HTML returned to browser

**Form Submission Flow:**

1. Client component (form) captures input
2. Form validation via React Hook Form + Zod schema
3. Server Action triggered (`use server`)
4. Server Action:
   - Validates input with Zod
   - Performs auth check (Supabase client)
   - Executes business logic
   - Inserts/updates database
   - Revalidates related paths
   - Returns success/error response
5. Client component updates UI based on response

**Payment Flow:**

1. Client initiates payment via API endpoint
2. POST `/api/payments/create` with payer details
3. API validates input and creates payment process with GROW
4. GROW returns payment URL
5. Client redirects to GROW checkout
6. After payment, GROW sends webhook to `/api/webhooks/grow`
7. Webhook verifies transaction and updates database
8. Client receives success/cancel redirect

**Assessment to Player Card Flow:**

1. Dashboard page fetches latest assessment for user
2. Identifies age group from user profile (`getAgeGroup()`)
3. Fetches all profiles in same age group
4. Fetches all assessments for same age group
5. Calculates group statistics
6. Converts assessment metrics to ratings (0-99 scale) using `calculateCardRatings()`
7. Renders PlayerCard component with ratings
8. If no group or insufficient data, uses neutral ratings (50)

## Key Abstractions

**Supabase Client Layer:**
- Purpose: Encapsulate database access patterns
- Examples: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`
- Pattern: Create client per request context (client-side vs server-side vs admin operations)
- Usage: `const supabase = await createClient(); const { data } = await supabase.from("table").select();`

**Zod Validation Schemas:**
- Purpose: Runtime validation of form inputs and API data
- Examples: `src/lib/validations/forms.ts`, `src/lib/validations/assessment.ts`
- Pattern: Define schema per form type, reuse across client validation and server-side checks
- Usage: `const validated = formSchema.parse(data)`

**Server Actions:**
- Purpose: Type-safe server mutations from client code
- Examples: `src/features/goals/lib/actions/set-goal.ts`, `src/features/achievements/lib/actions/get-achievements.ts`
- Pattern: Export async function with `"use server"` directive, handle auth within action
- Usage: `const result = await setGoal({ userId, metricKey, targetValue });`

**Feature Index Exports (Barrel Files):**
- Purpose: Clean API for consuming features
- Examples: `src/features/achievements/index.ts`, `src/features/goals/index.ts`
- Pattern: Export types, utilities, actions, components, and hooks from single entry point
- Usage: `import { AchievementsCard, enrichAchievement } from '@/features/achievements';`

**Rating Calculation System:**
- Purpose: Convert physical assessment metrics to player card ratings (0-99 scale)
- Location: `src/lib/assessment-to-rating.ts`
- Functions: `calculateCardRatings()` (percentile-based), `calculateNeutralRatings()`, `calculateGroupStats()`
- Pattern: Compare user assessment against age-group statistics

**Payment Gateway Integration:**
- Purpose: Abstraction over GROW (Meshulam) payment API
- Location: `src/lib/grow/client.ts`
- Functions: `createPaymentProcess()`, webhook parsing
- Pattern: Translate app domain (amount, description) to GROW-specific fields with retry logic

## Entry Points

**Landing Page:**
- Location: `src/app/page.tsx`
- Triggers: Root URL `/`
- Responsibilities: Renders homepage with navbar, hero, about, services, programs, testimonials, FAQ, contact, footer

**Dashboard:**
- Location: `src/app/dashboard/page.tsx`
- Triggers: Authenticated user accessing `/dashboard`
- Responsibilities:
  - Fetch user profile, assessments, forms, streaks, goals, achievements
  - Calculate player ratings for card display
  - Display quick actions (forms, videos)
  - Show statistics (pre/post-workout forms, videos watched, streaks, achievements)
  - Display active goals

**Admin Dashboard:**
- Location: `src/app/admin/page.tsx`
- Triggers: Trainer/admin accessing `/admin`
- Responsibilities:
  - Display aggregate statistics (users, forms, videos)
  - Show recent form submissions
  - Serve as hub for admin tools (users, assessments, videos, submissions, stats)

**Authentication Pages:**
- Location: `src/app/auth/login/page.tsx`, `src/app/auth/verify/page.tsx`, `src/app/auth/callback/route.ts`
- Triggers: Login flow, email verification
- Responsibilities: Email/password authentication, verification, session callback handling

**API Endpoints:**
- Payment Creation: `src/app/api/payments/create/route.ts` - POST endpoint for creating payments
- Webhooks: `src/app/api/webhooks/grow/route.ts` - POST endpoint for GROW payment webhooks

## Error Handling

**Strategy:** Layer-based error handling with user-facing messages.

**Patterns:**
- **Middleware:** Redirect to login for auth failures, to onboarding for incomplete profiles
- **Server Components:** Catch Supabase errors, render empty states or error messages
- **Server Actions:** Return `{ success: false, error: string }` object, let client display toast
- **API Routes:** Return `NextResponse.json({ error: string }, { status: code })`
- **Client Components:** Use try-catch for unexpected errors, display via toast notifications
- **Zod Validation:** Transform validation errors to user-friendly messages for forms

## Cross-Cutting Concerns

**Authentication:**
- Middleware checks auth state on every request
- Server components use `supabase.auth.getUser()` for explicit checks
- Server Actions verify user role before mutations
- Protected routes: `/dashboard/*` and `/admin/*` require auth
- Role-based access: `/admin/*` restricted to trainer/admin roles

**Authorization:**
- Profile completion check enforces onboarding flow
- Role-based middleware protection (trainee vs trainer vs admin)
- Server Actions verify user role with database query
- Feature actions (goals, achievements) require specific roles

**Validation:**
- Client-side: React Hook Form with Zod schemas for real-time feedback
- Server-side: Zod validation before database writes in Server Actions
- API layer: Comprehensive validation of payment request data

**Data Consistency:**
- Transactions via Supabase (database-level constraints)
- Path revalidation after mutations to refresh cached data
- Unique constraints prevent duplicate goals/assessments

**Logging:**
- Activity logs table tracks user actions (`src/types/activity-log.ts`)
- Console logging for errors (see payment API for examples)
- Audit trail for admin actions via activity_logs table

