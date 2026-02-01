# Codebase Structure

**Analysis Date:** 2026-02-01

## Directory Layout

```
garden-of-eden-website/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Landing page
│   │   ├── layout.tsx                # Root layout with fonts, globals
│   │   ├── globals.css               # Global styles
│   │   ├── middleware.ts             # Auth/route protection
│   │   ├── api/                      # API routes
│   │   │   ├── payments/create/      # Payment creation endpoint
│   │   │   └── webhooks/grow/        # GROW payment webhooks
│   │   ├── auth/                     # Authentication pages
│   │   │   ├── login/                # Email/password login form
│   │   │   ├── verify/               # Email verification page
│   │   │   └── callback/             # OAuth callback handler
│   │   ├── dashboard/                # User dashboard (protected)
│   │   │   ├── page.tsx              # Dashboard home
│   │   │   ├── assessments/          # Assessment history/comparison
│   │   │   ├── forms/                # Form submission pages
│   │   │   │   ├── pre-workout/      # Pre-workout form
│   │   │   │   ├── post-workout/     # Post-workout form
│   │   │   │   └── nutrition/        # Nutrition questionnaire
│   │   │   ├── rankings/             # Player rankings
│   │   │   ├── stats/                # Personal statistics
│   │   │   └── videos/               # Video library for users
│   │   ├── admin/                    # Admin panel (trainer/admin only)
│   │   │   ├── page.tsx              # Admin dashboard overview
│   │   │   ├── users/                # User management
│   │   │   ├── assessments/          # Assessment creation/editing
│   │   │   ├── submissions/          # View form submissions
│   │   │   ├── videos/               # Video management
│   │   │   └── stats/                # User statistics
│   │   ├── onboarding/               # Profile setup flow
│   │   │   └── profile/              # Profile completion form
│   │   ├── privacy-policy/           # Privacy policy page
│   │   └── terms-of-service/         # Terms of service page
│   │
│   ├── components/                   # Reusable React components
│   │   ├── ui/                       # Design system components
│   │   │   ├── button.tsx            # Base button component
│   │   │   ├── card.tsx              # Card layout component
│   │   │   ├── input.tsx             # Text input
│   │   │   ├── label.tsx             # Form label
│   │   │   ├── select.tsx            # Select dropdown (Radix)
│   │   │   ├── dialog.tsx            # Modal dialog
│   │   │   ├── tabs.tsx              # Tab component
│   │   │   ├── chart.tsx             # Recharts wrapper
│   │   │   ├── sonner.tsx            # Toast notifications
│   │   │   ├── badge.tsx             # Status badge
│   │   │   ├── slider.tsx            # Range slider
│   │   │   ├── switch.tsx            # Toggle switch
│   │   │   ├── tooltip.tsx           # Hover tooltip
│   │   │   ├── separator.tsx         # Visual divider
│   │   │   └── [16 more UI components]
│   │   ├── landing/                  # Landing page sections
│   │   │   ├── Navbar.tsx            # Navigation header
│   │   │   ├── Hero.tsx              # Hero banner section
│   │   │   ├── About.tsx             # About academy section
│   │   │   ├── Services.tsx          # Services offered
│   │   │   ├── Programs.tsx          # Training programs
│   │   │   ├── Philosophy.tsx        # Philosophy section
│   │   │   ├── Testimonials.tsx      # Client testimonials
│   │   │   ├── FAQ.tsx               # Frequently asked questions
│   │   │   ├── Contact.tsx           # Contact form section
│   │   │   └── Footer.tsx            # Footer with links
│   │   ├── dashboard/                # Dashboard-specific components
│   │   │   └── [Custom dashboard components]
│   │   ├── admin/                    # Admin-specific components
│   │   │   ├── AdminNav.tsx          # Admin sidebar navigation
│   │   │   ├── AssessmentForm.tsx    # Assessment creation form
│   │   │   ├── AssessmentStepContent.tsx  # Assessment step UI
│   │   │   ├── PlayerStatsForm.tsx   # Player stats input form
│   │   │   ├── UserEditForm.tsx      # User profile editor
│   │   │   ├── ActivityLogTable.tsx  # Activity log display
│   │   │   ├── ActivityLogRow.tsx    # Activity log row item
│   │   │   └── ClickableTableRow.tsx # Table row interaction
│   │   ├── payments/                 # Payment flow components
│   │   │   └── PaymentStatusHandler.tsx  # Handles payment success/cancel
│   │   ├── player-card/              # Player card (FIFA-style)
│   │   │   └── PlayerCard.tsx        # Displays player stats card
│   │   ├── onboarding/               # Onboarding flow components
│   │   └── forms/                    # Form components
│   │
│   ├── features/                     # Domain-specific feature modules
│   │   ├── achievements/             # Gamification badges system
│   │   │   ├── index.ts              # Public API exports
│   │   │   ├── types/                # Achievement types
│   │   │   ├── components/           # Achievement UI (badge, list, card)
│   │   │   ├── lib/
│   │   │   │   ├── config/           # Badge configuration
│   │   │   │   ├── utils/            # Achievement utilities
│   │   │   │   └── actions/          # Server actions (getAchievements)
│   │   │   ├── hooks/                # useAchievementCelebration hook
│   │   │   └── __tests__/
│   │   │
│   │   ├── goals/                    # Player goals (physical metrics)
│   │   │   ├── index.ts              # Public API exports
│   │   │   ├── types/                # Goal types
│   │   │   ├── components/           # Goals UI (list, form, card)
│   │   │   ├── lib/
│   │   │   │   ├── config/           # Goal metric configuration
│   │   │   │   ├── utils/            # Goal calculation utilities
│   │   │   │   └── actions/          # Server actions (setGoal, deleteGoal)
│   │   │   └── __tests__/
│   │   │
│   │   ├── streak-tracking/          # Workout streak gamification
│   │   │   ├── index.ts              # Public API exports
│   │   │   ├── types/                # Streak types
│   │   │   ├── components/           # Streak UI (card, celebration)
│   │   │   ├── lib/
│   │   │   │   ├── utils/            # Streak calculation
│   │   │   │   └── actions/          # Server actions (getStreak)
│   │   │   └── __tests__/
│   │   │
│   │   ├── rankings/                 # Player rankings by position
│   │   │   ├── index.ts              # Public API exports
│   │   │   ├── types/                # Ranking types
│   │   │   ├── components/           # Ranking UI (table, list)
│   │   │   ├── lib/
│   │   │   │   ├── utils/            # Ranking calculations
│   │   │   │   └── actions/          # Server actions (getRankings)
│   │   │   └── __tests__/ranking-utils.test.ts
│   │   │
│   │   ├── progress-charts/          # Assessment progress visualization
│   │   │   ├── index.ts              # Public API exports
│   │   │   ├── types/                # Chart types
│   │   │   ├── components/           # Chart UI (line, radar, etc)
│   │   │   ├── lib/
│   │   │   │   ├── config/           # Chart configuration
│   │   │   │   ├── utils/            # Chart utilities
│   │   │   │   └── transforms/       # Data transformation
│   │   │   └── __tests__/
│   │   │
│   │   ├── assessment-comparison/    # Compare own assessment to peer group
│   │   │   ├── index.ts              # Public API exports
│   │   │   ├── types/                # Comparison types
│   │   │   ├── components/           # Comparison UI
│   │   │   ├── lib/
│   │   │   │   ├── utils/            # Comparison logic
│   │   │   │   └── __tests__/comparison-utils.test.ts
│   │   │   └── __tests__/
│   │   │
│   │   └── form-drafts/              # Auto-save draft forms
│   │       ├── index.ts              # Public API exports
│   │       ├── types/                # Draft types
│   │       ├── lib/                  # Draft utilities
│   │       └── __tests__/
│   │
│   ├── lib/                          # Shared utilities and services
│   │   ├── supabase/                 # Database access layer
│   │   │   ├── client.ts             # Client-side Supabase client
│   │   │   ├── server.ts             # Server-side Supabase client
│   │   │   ├── admin.ts              # Admin client (bypasses RLS)
│   │   │   └── middleware.ts         # Session/auth middleware
│   │   │
│   │   ├── validations/              # Zod validation schemas
│   │   │   ├── forms.ts              # Pre/post-workout, nutrition forms
│   │   │   ├── assessment.ts         # Physical assessment validation
│   │   │   ├── player-stats.ts       # Player stats validation
│   │   │   ├── profile.ts            # Profile completion validation
│   │   │   └── user-edit.ts          # User profile edit validation
│   │   │
│   │   ├── grow/                     # Payment gateway integration
│   │   │   └── client.ts             # GROW API client with retry logic
│   │   │
│   │   ├── utils/                    # General utilities
│   │   │   ├── profile.ts            # Profile utility functions
│   │   │   ├── storage.ts            # File storage utilities
│   │   │   ├── uuid.ts               # UUID generation
│   │   │   └── redirect.ts           # Redirect utilities
│   │   │
│   │   ├── assessment-to-rating.ts   # Convert assessments to card ratings
│   │   ├── utils.ts                  # General helper functions
│   │   └── grow/                     # Growth/payment related
│   │       └── client.ts             # GROW payment client
│   │
│   ├── types/                        # Global type definitions
│   │   ├── database.ts               # Auto-generated Supabase types
│   │   ├── assessment.ts             # Assessment-specific types
│   │   ├── player-stats.ts           # Player statistics types
│   │   └── activity-log.ts           # Activity logging types
│   │
│   └── test/                         # Test utilities and setup
│       └── setup.ts                  # Test configuration
│
├── public/                           # Static assets
│   ├── favicon.ico
│   ├── og-image.png                 # Open Graph image
│   └── [icons, logos, etc]
│
├── .planning/                        # GSD planning documents
│   └── codebase/                     # Architecture & structure docs
│
└── Configuration files
    ├── package.json                  # Dependencies and scripts
    ├── tsconfig.json                 # TypeScript configuration
    ├── next.config.ts                # Next.js configuration
    ├── vitest.config.ts              # Vitest test runner config
    └── tailwind.config.[js|ts]       # Tailwind CSS configuration
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router pages and API endpoints
- Contains: Page components (page.tsx), layouts, API routes (route.ts), middleware
- Key files: Root layout applies global fonts/styles, middleware protects routes

**`src/components/ui/`:**
- Purpose: Reusable design system components (button, card, input, etc)
- Contains: Low-level unstyled (or minimally styled) primitives
- Pattern: Uses Radix UI for accessibility, Tailwind for styling
- Usage: Import and compose into domain-specific components

**`src/components/landing/`:**
- Purpose: Landing page sections (marketing site)
- Contains: Navbar, Hero, About, Services, Programs, FAQ, Contact, Footer, etc
- Pattern: Self-contained section components, composed in root page

**`src/components/admin/` & `src/components/dashboard/`:**
- Purpose: Domain-specific components for admin and user flows
- Contains: Forms, tables, cards specific to those areas
- Pattern: Larger, composite components built from UI primitives

**`src/features/[feature-name]/`:**
- Purpose: Encapsulate feature domain (achievements, goals, rankings, etc)
- Structure: `types/`, `components/`, `lib/`, `__tests__/`, `hooks/`, `index.ts`
- Pattern: All feature exports via barrel file (index.ts), self-contained
- Dependency: Only inbound imports from pages/components, not cross-feature

**`src/lib/supabase/`:**
- Purpose: Database access abstraction
- Files:
  - `client.ts`: Browser-safe client (use in client components)
  - `server.ts`: Server-only client (use in async server components)
  - `admin.ts`: Bypasses RLS, use only for system operations
  - `middleware.ts`: Session refresh and route protection
- Usage: `const supabase = await createClient();`

**`src/lib/validations/`:**
- Purpose: Centralized Zod schemas for form and data validation
- Pattern: One schema per form type, reused in client and server
- Usage: Input validation in Server Actions, client-side with React Hook Form

**`src/types/`:**
- Purpose: Global type definitions, especially database schema
- Files:
  - `database.ts`: Auto-generated from Supabase (DO NOT EDIT manually)
  - `assessment.ts`: Assessment-related types (age groups, metrics)
  - `player-stats.ts`: Player position and stats types
- Usage: Import types in components and utilities

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Landing page homepage
- `src/app/layout.tsx`: Root layout (HTML structure, fonts, global CSS)
- `src/app/dashboard/page.tsx`: User dashboard home
- `src/app/admin/page.tsx`: Admin dashboard overview
- `src/middleware.ts`: Request middleware (auth, route protection)

**Configuration:**
- `tsconfig.json`: Path aliases (`@/*` → `src/*`), strict mode enabled
- `package.json`: Next.js 16.1, React 19.2, Tailwind 4, Supabase client
- `vitest.config.ts`: Test runner setup
- `src/app/globals.css`: Global styles (Tailwind, custom CSS variables)

**Core Logic:**
- `src/lib/assessment-to-rating.ts`: Converts physical assessments to player card ratings
- `src/lib/grow/client.ts`: Payment gateway integration (GROW/Meshulam)
- `src/lib/supabase/middleware.ts`: Auth checks, route protection, profile validation

**Database Models:**
- `src/types/database.ts`: Supabase schema (profiles, assessments, forms, payments, streaks, goals, achievements, etc)

**Forms & Validation:**
- `src/lib/validations/forms.ts`: Pre/post-workout and nutrition form schemas
- `src/lib/validations/assessment.ts`: Physical assessment validation
- `src/lib/validations/player-stats.ts`: Player stats validation

**Features/Modules:**
- `src/features/achievements/lib/actions/get-achievements.ts`: Server action to fetch user badges
- `src/features/goals/lib/actions/set-goal.ts`: Server action to create player goals
- `src/features/rankings/lib/actions/get-rankings.ts`: Server action for ranking calculations
- `src/features/streak-tracking/lib/actions/get-streak.ts`: Server action for streak data

## Naming Conventions

**Files:**
- Page routes: `page.tsx` (Next.js convention)
- API endpoints: `route.ts` (Next.js convention)
- Components: PascalCase (e.g., `PlayerCard.tsx`, `AssessmentForm.tsx`)
- Utilities: camelCase (e.g., `assessment-to-rating.ts`, `profile.ts`)
- Server actions: `[action-name].ts` (e.g., `set-goal.ts`, `get-achievements.ts`)
- Tests: `[module].test.ts` or `[module].spec.ts`

**Directories:**
- Feature modules: kebab-case (e.g., `streak-tracking`, `form-drafts`)
- Feature subdirs: snake_case or lowercase (e.g., `lib/`, `components/`, `types/`)
- Route segments: kebab-case for dynamic or descriptive (e.g., `pre-workout`, `[userId]`)

**Type Files:**
- Database types: `database.ts`
- Feature-specific types: `types/index.ts` within feature
- Domain types: `[domain].ts` (e.g., `assessment.ts`, `player-stats.ts`)

## Where to Add New Code

**New Feature (e.g., meal plans):**
1. Create `src/features/meal-plans/`
2. Add subdirs: `types/`, `components/`, `lib/`, `__tests__/`, `hooks/` (if needed)
3. Create `lib/actions/` for server actions
4. Create `lib/utils/` for business logic
5. Create `lib/config/` for constants
6. Export all public APIs via `index.ts` barrel file
7. Import feature in pages via: `import { Component } from '@/features/meal-plans'`

**New Component (domain-specific):**
- UI primitive: `src/components/ui/[component].tsx`
- Landing section: `src/components/landing/[Section].tsx`
- Dashboard feature: `src/components/dashboard/[Component].tsx`
- Admin feature: `src/components/admin/[Component].tsx`
- Feature component: `src/features/[feature]/components/[Component].tsx`

**New Page/Route:**
1. Create folder in `src/app/` following next.js convention: `src/app/dashboard/new-page/`
2. Create `page.tsx` with async server component
3. Fetch data with `const supabase = await createClient()`
4. Import and compose components
5. Middleware automatically protects `/dashboard/*` and `/admin/*` routes

**New Validation Schema:**
1. Add to `src/lib/validations/[domain].ts` (create if needed)
2. Define Zod schema: `export const formSchema = z.object({ ... })`
3. Use in client with React Hook Form: `const form = useForm({ resolver: zodResolver(formSchema) })`
4. Use in server action: `const validated = formSchema.parse(data)`

**New Server Action:**
1. Create in `src/features/[feature]/lib/actions/[action-name].ts`
2. Add `"use server"` directive
3. Create Supabase client: `const supabase = await createClient()`
4. Verify auth: `const { data: { user } } = await supabase.auth.getUser()`
5. Return typed result: `{ success: boolean, error?: string, data?: T }`
6. Revalidate paths after mutations: `revalidatePath("/dashboard")`
7. Export from feature `index.ts`

**New Utility Function:**
- Reusable across features: `src/lib/utils/[domain].ts`
- Feature-specific: `src/features/[feature]/lib/utils/[utilities].ts`
- Assessment logic: `src/lib/assessment-to-rating.ts` (or extend)

## Special Directories

**`src/test/`:**
- Purpose: Test configuration and utilities
- Generated: No
- Committed: Yes
- Contains: Test setup, fixtures, helpers

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No

**`.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes
- Committed: No

**`public/`:**
- Purpose: Static assets served directly
- Generated: No
- Committed: Yes (except large media)
- Usage: Images, icons, fonts referenced as `/filename`

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents
- Generated: Yes (by GSD commands)
- Committed: Yes
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

