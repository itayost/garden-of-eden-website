# Garden of Eden

## What This Is

A comprehensive fitness and athletic training platform for an academy/gym in Israel. The application combines a public landing page, user dashboard for trainees to track fitness progress with FIFA-style player cards, and an admin panel for trainers to manage users and assessments. Includes payment processing for membership fees via GROW (Meshulam) gateway.

## Core Value

Trainees can track their fitness progress through assessments and see their improvement visualized as a FIFA-style player card with 0-99 ratings, motivating continued training.

## Requirements

### Validated

<!-- Shipped and working in existing codebase -->

- ✓ **LAND-01**: Public landing page with hero, about, services, programs, testimonials, FAQ, contact — existing
- ✓ **AUTH-01**: User authentication with email/password — existing
- ✓ **AUTH-02**: Email verification flow — existing
- ✓ **AUTH-03**: User onboarding with profile creation (name, position, birthdate, avatar) — existing
- ✓ **AUTH-04**: Role-based access control (trainee, trainer, admin) — existing
- ✓ **DASH-01**: User dashboard with quick actions and statistics — existing
- ✓ **CARD-01**: FIFA-style player card with 0-99 ratings based on assessments — existing
- ✓ **CARD-02**: Age-group percentile comparison for ratings — existing
- ✓ **ASMT-01**: Assessment viewing with before/after comparison — existing
- ✓ **ASMT-02**: Admin can create assessments for users — existing
- ✓ **ASMT-03**: Progress charts visualization — existing
- ✓ **GOAL-01**: Users can set fitness goals — existing
- ✓ **GOAL-02**: Goal progress tracking with percentages — existing
- ✓ **ACHV-01**: Achievement/badge system (gamification) — existing
- ✓ **STRK-01**: Workout streak tracking — existing
- ✓ **RANK-01**: Rankings/leaderboards by position — existing
- ✓ **FORM-01**: Pre/post workout form submission — existing
- ✓ **FORM-02**: Form draft auto-save (localStorage) — existing
- ✓ **VID-01**: Video library access for trainees — existing
- ✓ **PAY-01**: Payment creation via GROW gateway — existing
- ✓ **PAY-02**: Webhook handling for payment status — existing
- ✓ **ADMN-01**: Admin dashboard with aggregate statistics — existing
- ✓ **ADMN-02**: Admin user list viewing — existing
- ✓ **ADMN-03**: Admin assessment management (create/edit) — existing
- ✓ **ADMN-04**: Admin form submissions viewing — existing
- ✓ **ADMN-05**: Activity audit logs — existing

### Active

<!-- Current scope. Building toward these. -->

**Security (Phase 1):**
- [ ] **SEC-01**: Rate limiting on all API endpoints
- [ ] **SEC-02**: GROW webhook signature verification
- [ ] **SEC-03**: Type safety cleanup (remove `as unknown as` patterns)
- [ ] **SEC-04**: Database RLS policies for UPDATE/DELETE operations
- [ ] **SEC-05**: Soft delete pattern for critical data

**User Management - Admin (Phase 2):**
- [ ] **ADMN-06**: Admin can create new users
- [ ] **ADMN-07**: Admin can delete users (soft delete)
- [ ] **ADMN-08**: Admin can reset user passwords
- [ ] **ADMN-09**: Admin can search/filter users
- [ ] **ADMN-10**: Admin can bulk import/export users

**Video Management - Admin (Phase 3):**
- [ ] **VID-02**: Admin can create/edit/delete videos via UI
- [ ] **VID-03**: Admin can reorder videos
- [ ] **VID-04**: Video analytics (view counts, completion rates)
- [ ] **VID-05**: Video progress tracking (resume position)

**Data Export (Phase 4):**
- [ ] **EXP-01**: Export form submissions to CSV/Excel
- [ ] **EXP-02**: Export assessments to CSV/Excel/PDF
- [ ] **EXP-03**: GDPR-compliant user data export
- [ ] **ASMT-04**: Admin can delete assessments

**Profile & Settings (Phase 5):**
- [ ] **PROF-01**: Users can edit profile after onboarding
- [ ] **PROF-02**: Settings page with preferences
- [ ] **PROF-03**: Users can change phone number
- [ ] **PROF-04**: Users can delete their account
- [ ] **PROF-05**: Users can download their data (GDPR)

**Auth Enhancements (Phase 6):**
- [ ] **AUTH-05**: Password reset flow (forgot password)
- [ ] **AUTH-06**: Two-factor authentication (2FA)

**Notifications (Phase 7):**
- [ ] **NOTF-01**: In-app notification system
- [ ] **NOTF-02**: Notification preferences
- [ ] **NOTF-03**: Achievement/goal/streak notification triggers
- [ ] **NOTF-04**: Email notifications (optional)

**Form Drafts (Phase 8):**
- [ ] **FORM-03**: Server-side draft sync (cross-device)

**Testing (Phase 9):**
- [ ] **TEST-01**: Integration tests for critical flows
- [ ] **TEST-02**: E2E tests with Playwright
- [ ] **TEST-03**: CI pipeline with 60%+ coverage

**Performance (Phase 10):**
- [ ] **PERF-01**: Database query optimization
- [ ] **PERF-02**: Frontend pagination and memoization
- [ ] **PERF-03**: Lighthouse score 90+

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Real-time chat — High complexity, not core to fitness tracking value
- Mobile native app — Web-first approach, mobile can come later
- OAuth login (Google, GitHub) — Email/password sufficient for gym context
- Custom workout builder — Trainers handle programming externally
- Diet/nutrition tracking — Outside current scope, focus on physical metrics

## Context

**Technical Environment:**
- Next.js 16 with App Router and React 19
- Supabase for PostgreSQL database and authentication
- GROW (Meshulam) for Israeli payment processing
- Deployed on Vercel

**Current State:**
- Codebase inherited, preparing for production launch
- Live payment gateway configured but site not yet live with users
- Core functionality works but missing admin controls and security hardening
- 49 instances of `as unknown as` type safety bypasses identified
- ~5% test coverage (2 test files)

**User Context:**
- Primary users: Athletes/trainees at Israeli gym
- Secondary users: Trainers/coaches (admin role)
- Hebrew-speaking audience (RTL considerations)

## Constraints

- **Tech Stack**: Must use existing Next.js + Supabase + GROW stack — significant codebase investment
- **Payment Gateway**: GROW (Meshulam) required — Israeli market, already integrated
- **Deployment**: Vercel — already configured, team familiar
- **Language**: Hebrew UI expected — RTL layout considerations

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Soft delete over hard delete | Data recovery, audit trail, GDPR compliance | — Pending |
| Server-side form drafts | Cross-device sync, user expectation | — Pending |
| Integrated testing per phase | Avoid testing debt, catch issues early | — Pending |
| Security first (Phase 1) | Live payments configured, can't launch with vulnerabilities | — Pending |

---
*Last updated: 2026-02-01 after initialization*
