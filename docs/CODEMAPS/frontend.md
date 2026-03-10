<!-- Generated: 2026-03-10 | Files scanned: 404 | Token estimate: ~850 -->

# Frontend Architecture

## Page Tree

```
/ (landing page)
/auth/login             WhatsApp OTP login
/auth/verify            OTP verification
/auth/verify-2fa        2FA verification
/auth/callback          Auth callback (route handler)
/onboarding/profile     New user onboarding

/dashboard              Trainee home (ratings, stats)
/dashboard/assessments  View assessments + comparison
/dashboard/forms        Pre/post workout form hub
/dashboard/forms/pre-workout    Pre-workout form
/dashboard/forms/post-workout   Post-workout form
/dashboard/forms/nutrition      Nutrition form
/dashboard/nutrition    Meal plans + PDF viewer
/dashboard/rankings     Leaderboard
/dashboard/videos       Training videos
/dashboard/settings/security    2FA settings

/admin                  Admin dashboard home
/admin/users            User management table
/admin/users/create     Create new user
/admin/users/[userId]   Edit user details
/admin/assessments      Assessment overview table
/admin/assessments/[userId]              User assessments
/admin/assessments/[userId]/new          New assessment
/admin/assessments/[userId]/[id]/edit    Edit assessment
/admin/nutrition        Nutrition management
/admin/nutrition/[userId]  User meal plan
/admin/videos           Video management
/admin/videos/create    Upload new video
/admin/shifts           Trainer shift management
/admin/leads            Lead CRM
/admin/submissions      Form submissions viewer
/admin/submissions/[formType]/[formId]   Single submission
/admin/submissions/shift-reports/[id]    Shift report detail
/admin/end-of-shift     End-of-shift report form

/privacy-policy         Static legal page
/terms-of-service       Static legal page
```

## Component Hierarchy

```
src/components/
  ui/                28 shadcn/ui primitives (Radix + Tailwind)
  admin/             Admin-specific: tables, forms, toolbars, nav
    exports/         CSV export buttons (per-entity, Hebrew headers)
    leads/           Lead CRM components
    nutrition/       Admin nutrition components
    shifts/          Shift management components
    submissions/     Form submission viewers
    users/           User management components
    videos/          Video management components
    assessments/     Assessment management components
    stats/           Player stats components
    shift-report/    Shift report components
  dashboard/         Trainee dashboard widgets
  forms/             Pre/post workout form components
  landing/           Landing page sections
  auth/              Auth flow components
  onboarding/        Onboarding flow components
  payments/          Payment components
  player-card/       FIFA-style player card
```

## Feature Modules (src/features/)

```
achievements/          Badge system (hooks, components, lib, types)
assessment-comparison/ Side-by-side assessment comparison
form-drafts/           Offline form draft persistence
goals/                 Personal goal tracking
nutrition/             Nutrition tracking + meal plans
onboarding-tour/       Guided onboarding tour (driver.js)
progress-charts/       Recharts-based progress visualization
rankings/              Leaderboard + ranking logic
streak-tracking/       Workout streak tracking
```

## Shared Hooks (src/hooks/)

```
useFormSubmission    Form submit state + error handling
useIsMobile          Mobile breakpoint detection
useMediaQuery        Generic media query hook
use-mfa              MFA management
use-connection-status  Online/offline detection
use-shift-queue-sync   Offline shift queue sync
useBackgroundRemoval   Image background removal (HuggingFace)
```

## State Management
- No global state library; React Server Components + server actions
- URL state via `nuqs` (search params)
- Form state via `react-hook-form` + `zod` validation
- Theme via `next-themes`
- Animations via `framer-motion`
