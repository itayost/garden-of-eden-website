# Mobile-Friendly Dev Plan — Garden of Eden

> **Goal**: Make the entire system mobile-friendly across all pages (dashboard, admin, landing, auth), add bottom navigation, convert data tables to card layouts, and add PWA support.
>
> **Work phase-by-phase. Start each phase with its task list. Mark tasks done as you go.**

---

## Phase 1: Foundation & Shared Utilities
> Create the reusable pieces everything else depends on.

### Tasks
- [x] **1.1** Create `src/hooks/useMediaQuery.ts` — reusable media query hook
- [x] **1.2** Create `src/hooks/useIsMobile.ts` — uses `useMediaQuery` with `md` breakpoint (768px)
- [x] **1.3** Create `public/manifest.json` — PWA manifest (app name, icons, theme color `#0A1F0A`, `display: standalone`). Reuse existing icons: `/icon-192x192.png`, `/icon-512x512.png`, `/apple-touch-icon.png`
- [x] **1.4** Create `public/sw.js` — minimal service worker for PWA installability
- [x] **1.5** Modify `src/app/layout.tsx` — add manifest link, theme-color meta, `viewport-fit=cover` for notch devices, register service worker
- [x] **1.6** Modify `src/app/globals.css` — add `.scrollbar-hide` utility, safe-area-inset-bottom support, bottom-nav spacing utility
- [x] **1.7** Create `src/components/ui/bottom-nav.tsx` — shared bottom navigation (fixed bottom, `md:hidden`, accepts `items[]`, active state via pathname, frosted glass backdrop, safe-area padding)
- [x] **1.8** Create `src/components/dashboard/DashboardBottomNav.tsx` — items: Home, Assessments, Forms, Rankings, More (opens Sheet with Videos, Nutrition)
- [x] **1.9** Create `src/components/admin/AdminBottomNav.tsx` — items: Dashboard, Users, Assessments, Submissions, More (opens Sheet with Videos, Nutrition, Shift Report)
- [x] **1.10** Modify `src/components/ui/tabs.tsx` — make `TabsList` horizontally scrollable on mobile (`overflow-x-auto scrollbar-hide`, tab items `flex-shrink-0`)
- [x] **1.11** Verify build passes: `npm run build`

### Key Files
| Action | File |
|--------|------|
| Create | `src/hooks/useMediaQuery.ts` |
| Create | `src/hooks/useIsMobile.ts` |
| Create | `public/manifest.json` |
| Create | `public/sw.js` |
| Create | `src/components/ui/bottom-nav.tsx` |
| Create | `src/components/dashboard/DashboardBottomNav.tsx` |
| Create | `src/components/admin/AdminBottomNav.tsx` |
| Modify | `src/app/layout.tsx` |
| Modify | `src/app/globals.css` |
| Modify | `src/components/ui/tabs.tsx` |

---

## Phase 2: Navigation Overhaul
> Wire up bottom nav, update top nav for mobile, add bottom padding to layouts.

### Tasks
- [x] **2.1** Modify `src/components/dashboard/DashboardNav.tsx` — remove hamburger/Sheet menu on mobile (keep desktop nav + logo + user menu)
- [x] **2.2** Modify `src/app/dashboard/layout.tsx` — add `<DashboardBottomNav>`, add `pb-20 md:pb-8` to main content
- [x] **2.3** Modify `src/components/admin/AdminNav.tsx` — remove hamburger/Sheet on mobile, keep logo + badge + user menu
- [x] **2.4** Modify `src/app/admin/layout.tsx` — add `<AdminBottomNav>`, add `pb-20 md:pb-8` to main content
- [x] **2.5** Test: bottom nav appears on mobile, correct active states, "More" sheet opens, no overlap with content

### Key Files
| Action | File |
|--------|------|
| Modify | `src/components/dashboard/DashboardNav.tsx` |
| Modify | `src/app/dashboard/layout.tsx` |
| Modify | `src/components/admin/AdminNav.tsx` |
| Modify | `src/app/admin/layout.tsx` |

---

## Phase 3: Dashboard Pages (Trainee Area)
> Fix layouts, grids, and data display on all trainee-facing pages.

### Tasks
- [x] **3.1** `src/app/dashboard/page.tsx` — Fix stats grid: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`
- [x] **3.2** `src/app/dashboard/page.tsx` — Fix nutrition alert card: change `flex justify-between` to `flex flex-col sm:flex-row gap-3` so button stacks on mobile
- [x] **3.3** `src/app/dashboard/assessments/page.tsx` — Hide player card sidebar on mobile: add `hidden lg:block` to left column, keep charts fullwidth
- [x] **3.4** `src/app/dashboard/assessments/page.tsx` — Fix history card grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`
- [x] **3.5** `src/features/rankings/components/CategoryLeaderCards.tsx` — Tightened gap on mobile (gap-3 vs gap-4), kept 2-col grid (better UX than horizontal scroll)
- [x] **3.6** `src/features/rankings/components/LeaderboardTable.tsx` — Add mobile card view: show each player as a card (rank, name, score) on mobile, keep table on desktop
- [x] **3.7** `src/app/dashboard/forms/page.tsx` — Verified: grid stacks properly on mobile ✓
- [x] **3.8** Nutrition page charts — Verified: `ResponsiveContainer` used correctly in SleepChart ✓
- [x] **3.9** `src/app/dashboard/videos/page.tsx` — Verified: tabs wrap with flex-wrap, video cards stack on mobile ✓
- [x] **3.10** Form pages (pre-workout, post-workout, nutrition forms) — Verified: mobile layout OK ✓
- [x] **3.11** Build passes ✓

### Key Files
| Action | File |
|--------|------|
| Modify | `src/app/dashboard/page.tsx` |
| Modify | `src/app/dashboard/assessments/page.tsx` |
| Modify | `src/features/rankings/components/CategoryLeaderCards.tsx` |
| Modify | `src/features/rankings/components/LeaderboardTable.tsx` |
| Verify | `src/app/dashboard/forms/page.tsx` |
| Verify | `src/features/nutrition/components/SleepChart.tsx` |
| Verify | `src/app/dashboard/videos/page.tsx` |
| Verify | `src/app/dashboard/forms/pre-workout/page.tsx` |
| Verify | `src/app/dashboard/forms/post-workout/page.tsx` |
| Verify | `src/app/dashboard/forms/nutrition/page.tsx` |

---

## Phase 4: Admin Pages
> Convert tables to card layouts, fix headers, optimize forms for mobile.

### Tasks
- [x] **4.1** `src/app/admin/page.tsx` — Fix stats grid: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`
- [x] **4.2** `src/app/admin/users/page.tsx` — Fix header layout: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4` so Import/Export buttons stack below on mobile
- [x] **4.3** `src/components/admin/users/UserDataTable.tsx` — Added mobile card view (avatar, name, phone, role badge, status badge) with `sm:hidden` / `hidden sm:block`, sharing TanStack pagination
- [x] **4.4** `src/components/admin/users/UserTableToolbar.tsx` — Already responsive: `flex-col → md:flex-row`, `w-full → md:w-64` ✓
- [x] **4.5** `src/app/admin/assessments/page.tsx` — Added mobile card layout (name, age group, assessment count, completeness, action buttons)
- [x] **4.6** `src/app/admin/assessments/[userId]/new/page.tsx` — ProgressStepper already has mobile dots + desktop labels, AssessmentStepContent uses responsive grids ✓
- [x] **4.7** `src/components/admin/submissions/SubmissionsContent.tsx` — Added mobile card views for all 3 tables (pre-workout, post-workout, nutrition) with Link navigation
- [x] **4.8** `src/components/admin/submissions/ShiftReportContent.tsx` — Added mobile card view with flag badges
- [x] **4.9** `src/app/admin/users/[userId]/page.tsx` — Fixed header to `flex-col sm:flex-row`, grid `lg:grid-cols-3` already stacks on mobile ✓
- [x] **4.10** `src/app/admin/videos/page.tsx` — Fixed header layout, VideoDataTable uses `overflow-x-auto` fallback ✓
- [x] **4.11** `src/app/admin/end-of-shift/page.tsx` — `max-w-3xl mx-auto`, ProgressStepper handles mobile, form inputs full-width ✓
- [x] **4.12** `src/app/admin/nutrition/` — Added mobile card view for trainees table, summary cards grid already stacks ✓
- [x] **4.13** Build passes ✓

### Key Files
| Action | File |
|--------|------|
| Modify | `src/app/admin/page.tsx` |
| Modify | `src/app/admin/users/page.tsx` |
| Modify | `src/components/admin/users/UserDataTable.tsx` |
| Modify | `src/components/admin/users/UserTableToolbar.tsx` |
| Modify | `src/app/admin/assessments/page.tsx` |
| Modify | `src/app/admin/assessments/[userId]/new/page.tsx` |
| Modify | `src/components/admin/submissions/SubmissionsContent.tsx` |
| Modify | `src/components/admin/submissions/ShiftReportContent.tsx` |
| Modify | `src/app/admin/users/[userId]/page.tsx` |
| Verify | `src/app/admin/videos/page.tsx` |
| Verify | `src/app/admin/end-of-shift/page.tsx` |
| Verify | `src/app/admin/nutrition/` |

---

## Phase 5: Landing Page & Auth
> Verification pass — these are mostly responsive already.

### Tasks
- [x] **5.1** `src/components/landing/Navbar.tsx` — Verified: full-screen mobile overlay menu with AnimatePresence, adequate touch targets (w-10 h-10), CTA buttons stack vertically ✓
- [x] **5.2** `src/components/landing/Hero.tsx` — Verified: `text-4xl md:text-5xl lg:text-6xl`, `flex-wrap` on CTA buttons, `px-6` padding ✓
- [x] **5.3** `src/components/landing/Services.tsx` — Verified: `md:grid-cols-4` stacks to 1 col on mobile, cards have full-width CTA buttons ✓
- [x] **5.4** `src/components/landing/Footer.tsx` — Verified: `md:grid-cols-12` stacks to 1 col, bottom bar `flex-col md:flex-row`, back-to-top button positioned ✓
- [x] **5.5** Remaining landing components — Verified: About (`lg:grid-cols-2`), Programs (`grid-cols-2 md:grid-cols-4` image gallery), Testimonials (vertical YouTube `md:grid-cols-2`), FAQ (`max-w-3xl` accordion), Contact (`lg:grid-cols-2`, `grid-cols-2` contact cards) — all responsive ✓
- [x] **5.6** `src/app/auth/login/page.tsx` — Verified: `max-w-md` card, tabs `grid-cols-2` fit, full-width inputs with icons, `p-4` wrapper padding ✓
- [x] **5.7** `src/app/auth/verify/page.tsx` — Fixed: OTP inputs `w-10` overflowed on 8-digit email codes. Changed to `w-8 sm:w-10 h-11 sm:h-12` with `gap-1 sm:gap-2` and `px-0`. Now fits 295px content area on 375px phones.
- [x] **5.8** `src/components/onboarding/ProfileCompletionForm.tsx` — Verified: `max-w-lg`, single-column form, full-width inputs, native date picker, Select component ✓
- [x] **5.9** Fixed OTP overflow issue (task 5.7). Build passes ✓

### Key Files
| Action | File |
|--------|------|
| Verify | `src/components/landing/Navbar.tsx` |
| Verify | `src/components/landing/Hero.tsx` |
| Verify | `src/components/landing/Services.tsx` |
| Verify | `src/components/landing/Footer.tsx` |
| Verify | `src/app/auth/login/page.tsx` |
| Verify | `src/app/auth/verify/page.tsx` |
| Verify | `src/app/onboarding/profile/page.tsx` |

---

## Phase 6: Component-Level Polish
> Fine-tune individual components, fix edge cases.

### Tasks
- [x] **6.1** `src/components/player-card/PlayerCard.tsx` — Verified: `md` size (180px) fits on 375px, `lg` usages are `hidden lg:block`. No change needed ✓
- [x] **6.2** Verified all charts use `ResponsiveContainer` — RatingTrendChart, SleepChart, DistributionChart, PhysicalMetricChart, MiniRatingChart all correct ✓
- [x] **6.3** `src/components/ui/dialog.tsx` — Verified: `max-w-[calc(100%-2rem)] sm:max-w-lg`, footer `flex-col-reverse` on mobile ✓
- [x] **6.4** Touch target audit — Fixed: ProgressStepper mobile dots increased from 12px to 28px touch area (visual dot stays 12px). RatingTrendChart stat toggles increased from `h-7 px-2` to `h-8 px-3`. Base button/input/select (`h-9`=36px) left as shadcn defaults — consistent across app.
- [x] **6.5** Text truncation — Verified: PlayerCard has `truncate`, mobile card views use `truncate`, bottom nav uses short labels. No overflow issues found ✓
- [x] **6.6** RTL verification — Verified in Phase 5: `dir="rtl"` on root, charts `dir="ltr"`, phone/email inputs `dir="ltr"`, flex margins work correctly in RTL ✓
- [x] **6.7** Final build passes: `npm run build` ✓
- [x] **6.8** Full audit of all forms, wizards, and in-page components:
  - Dashboard forms (pre-workout, post-workout, nutrition): `max-w-2xl`, single-column, full-width inputs ✓
  - Assessment wizard: ProgressStepper mobile view + responsive grid steps ✓
  - Shift report wizard: Same pattern, TraineeMultiSelect with search ✓
  - MealPlanForm: **Fixed** — changed `grid-cols-7` to `flex overflow-x-auto scrollbar-hide` for day tabs
  - SetGoalDialog, PaymentFormModal: `sm:max-w-md`, full-width fields ✓
  - All dialogs: mobile max-width + stacked footer buttons ✓

### Key Files
| Action | File |
|--------|------|
| Verify | `src/components/player-card/PlayerCard.tsx` — no change needed |
| Verify | `src/features/progress-charts/` — all use ResponsiveContainer |
| Verify | `src/features/rankings/components/DistributionChart.tsx` |
| Verify | `src/features/nutrition/components/SleepChart.tsx` |
| Verify | `src/components/ui/dialog.tsx` |
| Modify | `src/components/ui/progress-stepper.tsx` — mobile dots touch area |
| Modify | `src/features/progress-charts/components/RatingTrendChart.tsx` — toggle button size |
| Modify | `src/components/admin/nutrition/MealPlanForm.tsx` — day tabs scrollable |

---

## Verification Checklist (End of Each Phase)

| Check | Command / Method |
|-------|-----------------|
| Build passes | `npm run build` |
| Tests pass | `npm run test:run` |
| No horizontal overflow | Chrome DevTools → 375px width → scroll right |
| Bottom nav works | Navigate all items, check active states |
| PWA installable | Chrome → install prompt appears |
| RTL correct | All layouts flow right-to-left properly |
| Touch targets | All interactive elements >= 44x44px |
| Safe areas | No content hidden behind notch/home indicator |

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/hooks/useMediaQuery.ts` | Reusable media query hook |
| `src/hooks/useIsMobile.ts` | Mobile breakpoint detection |
| `src/components/ui/bottom-nav.tsx` | Shared bottom navigation component |
| `src/components/dashboard/DashboardBottomNav.tsx` | Dashboard mobile bottom nav |
| `src/components/admin/AdminBottomNav.tsx` | Admin mobile bottom nav |
| `public/manifest.json` | PWA web app manifest |
| `public/sw.js` | Service worker for PWA |
