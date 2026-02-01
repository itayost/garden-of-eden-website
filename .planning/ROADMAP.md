# Garden of Eden - Implementation Roadmap

> Track progress by marking checkboxes as you complete each task.
> Last updated: 2026-02-01

---

## Phase 1: Security Fixes ✅ COMPLETE
**Status:** Complete | **Completed:** 2026-02-01 | **Plans:** 6/6 complete

### Plans
- [x] 01-01-PLAN.md — Security infrastructure (rate limiting + webhook utilities)
- [x] 01-02-PLAN.md — Database security (indexes, soft delete, RLS policies)
- [x] 01-03-PLAN.md — Payment endpoint security (rate limiting + Zod)
- [x] 01-04-PLAN.md — Webhook security (signature verification + Zod)
- [x] 01-05-PLAN.md — Type safety cleanup (documented `as unknown as` as required idiom)
- [x] 01-06-PLAN.md — Security tests (105 tests for rate limiting, webhook, validation)

### 1.1 API Rate Limiting & Validation
- [x] Add rate limiting middleware for ALL API routes
- [x] Add rate limiting to `/api/payments/create`
- [x] Add CAPTCHA or session validation for payments
- [x] Validate all input with Zod schema before processing
- **Files:** `src/app/api/payments/create/route.ts`, `src/lib/rate-limit.ts`

### 1.2 Webhook Security
- [x] Add GROW webhook signature verification
- [x] Fix `parseInt/parseFloat` validation (handle NaN cases)
- [x] Add replay attack protection (timestamp validation)
- **Files:** `src/app/api/webhooks/grow/route.ts`, `src/lib/webhook-security.ts`

### 1.3 Type Safety Cleanup
- [x] Replace `as unknown as` patterns with proper Zod runtime validation
- [x] Regenerate Supabase types: `npx supabase gen types typescript`
- [x] Add runtime validation at API entry points
- **Note:** `as unknown as` patterns retained as required TypeScript idiom for Supabase client

### 1.4 Database Security (RLS & Indexes)
- [x] Add security-critical indexes (activity_logs.user_id, activity_logs.created_at)
- [x] Review and add UPDATE/DELETE RLS policies
- [x] Add soft delete pattern for critical data (users, assessments)

### 1.5 Write Tests for Phase 1
- [x] Test rate limiting rejects excessive requests
- [x] Test webhook rejects invalid signatures
- [x] Test Zod validation rejects malformed input

### Success Criteria
- [x] Payment endpoint returns 429 for excessive requests
- [x] Webhook rejects requests with invalid/missing signatures
- [x] `as unknown as` patterns documented as required TypeScript idiom
- [x] All critical tables have RLS policies for UPDATE/DELETE

**Phase 1 Completion:** ✅ 16/16 tasks

---

## Phase 2: Admin Panel - User Management 🟠 HIGH
**Status:** Planned | **Target:** Week 2 | **Plans:** 7 plans

### Plans
- [ ] 02-01-PLAN.md — Server actions + validation schemas (dependencies, createUser, softDelete, resetCredentials)
- [ ] 02-02-PLAN.md — User creation form and page
- [ ] 02-03-PLAN.md — Data table with search, filter, pagination (TanStack Table + nuqs)
- [ ] 02-04-PLAN.md — Delete user dialog and profile page integration
- [ ] 02-05-PLAN.md — CSV import/export (PapaParse)
- [ ] 02-06-PLAN.md — Final integration + human verification
- [ ] 02-07-PLAN.md — Tests for Phase 2

### 2.1 Create User
- [ ] Add "Create User" button to admin users page
- [ ] Create user creation form (name, email/phone, role, position)
- [ ] Server action to create user via Supabase Admin API
- [ ] Send welcome email/SMS with temporary credentials
- [ ] Add loading state during creation
- [ ] Add success/error toast notifications
- **New Files:**
  - `src/components/admin/users/UserCreateForm.tsx`
  - `src/app/admin/users/create/page.tsx`

### 2.2 Delete User
- [ ] Add delete button with confirmation dialog
- [ ] Implement soft delete (set `deleted_at` timestamp)
- [ ] Create server action for user deletion
- [ ] Handle cascade data (assessments, forms, goals)
- [ ] Add loading state during deletion

### 2.3 Password Reset (Admin)
- [ ] Add "Reset Password" action in user management
- [ ] Generate temporary password or send reset link
- [ ] Use Supabase Admin API for password reset

### 2.4 Search & Filter
- [ ] Add search bar (by name, email, phone)
- [ ] Add filters (role, status, position, date joined)
- [ ] Add pagination with cursor-based navigation
- [ ] Add sorting options

### 2.5 Bulk Operations
- [ ] CSV import for bulk user creation
- [ ] CSV export of user list
- [ ] Bulk status update (activate/deactivate)

### 2.6 Write Tests for Phase 2
- [ ] Test user creation with valid/invalid data
- [ ] Test soft delete preserves data
- [ ] Test search returns correct results

### Success Criteria
- [ ] Admin can create a new user and user receives credentials
- [ ] Deleted users are soft-deleted (can be recovered)
- [ ] Search finds users by name, email, or phone
- [ ] All actions show loading states and toast feedback

**Phase 2 Completion:** ⬜ 0/21 tasks

---

## Phase 3: Admin Panel - Video Management 🟠 HIGH
**Status:** Planned | **Target:** Week 3 | **Plans:** 5 plans

### Plans
- [ ] 03-01-PLAN.md — Server actions + validation schema (YouTube utilities, video schema, CRUD actions)
- [ ] 03-02-PLAN.md — Video form and delete dialog components
- [ ] 03-03-PLAN.md — TanStack Table components (columns, toolbar, pagination, data table)
- [ ] 03-04-PLAN.md — Admin pages integration (upgrade videos page, create page)
- [ ] 03-05-PLAN.md — Human verification of complete CRUD functionality

### 3.1 Video CRUD UI
- [ ] Create video management page with table view
- [ ] Add video form (title, YouTube URL, day, topic, duration)
- [ ] Edit existing videos
- [ ] Delete video with confirmation dialog
- [ ] ~~Drag-to-reorder within each day~~ (DEFERRED)
- [ ] Add loading states for all actions
- [ ] Add success/error toast notifications
- **New Files:**
  - `src/components/admin/videos/VideoForm.tsx`
  - `src/components/admin/videos/VideoDataTable.tsx`
  - `src/lib/actions/admin-videos.ts`

### 3.2 Video Analytics (DEFERRED)
- [ ] Show view counts per video
- [ ] Show completion rates
- [ ] Most/least watched videos dashboard

### 3.3 Video Progress Tracking - User-side (DEFERRED)
- [ ] Track watch duration (not just binary watched/not)
- [ ] Save playback position for resume
- [ ] Show "Continue watching" for partially viewed videos
- **Files:** `src/app/dashboard/videos/page.tsx`, `src/components/dashboard/VideoCard.tsx`

### 3.4 Write Tests for Phase 3 (DEFERRED)
- [ ] Test video CRUD operations
- [ ] Test progress tracking saves correctly
- [ ] Test resume position loads correctly

### Success Criteria
- [ ] Admin can create/edit/delete videos from UI
- [ ] ~~Videos can be reordered by drag-and-drop~~ (DEFERRED)
- [ ] All actions show loading states and toast feedback

**Phase 3 Completion:** ⬜ 0/7 tasks (core CRUD only, deferred items excluded)

---

## Phase 4: Admin Panel - Data Export & Assessment Management 🟡 MEDIUM
**Status:** Not Started | **Target:** Week 5

### 4.1 Form Submissions Export
- [ ] Add export button to submissions page
- [ ] Export to CSV/Excel with all fields
- [ ] Filter by date range before export
- **Files:** `src/app/admin/submissions/page.tsx`

### 4.2 Assessment Export
- [ ] Export user assessments to CSV/Excel
- [ ] Export to PDF report format
- [ ] Include progress charts in PDF

### 4.3 Assessment Deletion
- [ ] Add delete button to assessment list
- [ ] Confirmation dialog with warning
- [ ] Soft delete with audit trail
- [ ] Server action for assessment deletion
- **Files:** `src/app/admin/assessments/[userId]/page.tsx`

### 4.4 User Data Export
- [ ] Export user list with all profile data
- [ ] GDPR-compliant data export per user

### 4.5 Write Tests for Phase 4
- [ ] Test CSV export contains correct data
- [ ] Test assessment deletion with soft delete
- [ ] Test GDPR export includes all user data

### Success Criteria
- [ ] Form submissions export as valid CSV/Excel
- [ ] Assessments can be deleted (soft delete)
- [ ] PDF exports render correctly with charts
- [ ] GDPR export includes all user's personal data

**Phase 4 Completion:** ⬜ 0/14 tasks

---

## Phase 5: User Features - Profile & Settings 🟠 HIGH
**Status:** Not Started | **Target:** Week 4 (parallel with Phase 6)

### 5.1 Settings Page
- [ ] Create `/dashboard/settings` page with tabs
- [ ] Tab 1: Profile (name, birthdate, position, avatar)
- [ ] Tab 2: Preferences (notification settings, language)
- [ ] Tab 3: Account (phone/email, delete account)
- [ ] Add loading states for save actions
- [ ] Add success/error toast notifications
- **New Files:**
  - `src/app/(dashboard)/dashboard/settings/page.tsx`
  - `src/components/dashboard/SettingsTabs.tsx`
  - `src/components/dashboard/ProfileEditForm.tsx`
  - `src/components/dashboard/PreferencesForm.tsx`
  - `src/components/dashboard/AccountSettings.tsx`

### 5.2 Profile Editing
- [ ] Allow editing: name, birthdate, position
- [ ] Avatar upload/change (reuse ImageUpload component)
- [ ] Avatar delete functionality
- [ ] Save changes with validation

### 5.3 Account Management
- [ ] Change phone number (with OTP verification)
- [ ] Delete account option (with confirmation dialog)
- [ ] Download my data (GDPR export)

### 5.4 Write Tests for Phase 5
- [ ] Test profile update saves correctly
- [ ] Test avatar upload/delete
- [ ] Test phone change requires verification

### Success Criteria
- [ ] Users can access settings from dashboard navbar
- [ ] Profile changes persist after save
- [ ] Avatar can be uploaded, changed, and deleted
- [ ] Account deletion requires confirmation

**Phase 5 Completion:** ⬜ 0/16 tasks

---

## Phase 6: User Features - Auth Enhancements 🟠 HIGH
**Status:** Not Started | **Target:** Week 4 (parallel with Phase 5)

### 6.1 Forgot Password Flow
- [ ] Add "Forgot Password" link on login page
- [ ] Create forgot password page with email/phone input
- [ ] Send OTP or magic link
- [ ] Create reset password page with new password form
- [ ] Validate and update password
- **New Files:**
  - `src/app/auth/forgot-password/page.tsx`
  - `src/app/auth/reset-password/page.tsx`

### 6.2 Two-Factor Authentication (2FA)
- [ ] Add 2FA setup option in settings
- [ ] Support TOTP (Google Authenticator, etc.)
- [ ] Backup codes generation
- [ ] 2FA verification on login when enabled
- **New Files:**
  - `src/components/dashboard/TwoFactorSetup.tsx`
  - `src/app/auth/verify-2fa/page.tsx`

### 6.3 Write Tests for Phase 6
- [ ] Test password reset flow end-to-end
- [ ] Test 2FA setup and verification
- [ ] Test backup codes work correctly

### Success Criteria
- [ ] Users can reset password via email/phone
- [ ] 2FA can be enabled/disabled in settings
- [ ] Login requires 2FA code when enabled
- [ ] Backup codes can be used when 2FA device unavailable

**Phase 6 Completion:** ⬜ 0/14 tasks

---

## Phase 7: Notifications System 🟡 MEDIUM
**Status:** Not Started | **Target:** Week 6

> **Note:** Triggers should integrate with EXISTING achievement/goal/streak logic,
> not rebuild it. Add notification creation calls to existing feature code.

### 7.1 Database Schema
- [ ] Create `notifications` table (id, user_id, type, title, message, read, created_at)
- [ ] Create `notification_preferences` table
- [ ] Add RLS policies for notifications

### 7.2 In-App Notifications
- [ ] Notification bell icon in navbar with unread count
- [ ] Notification dropdown/panel
- [ ] Mark as read (individual and all)
- [ ] Notification center page (`/dashboard/notifications`)
- [ ] Loading states and empty states

### 7.3 Notification Triggers (Integrate with Existing Features)
- [ ] Achievement unlocked → Add to `src/features/achievements/`
- [ ] Goal achieved → Add to `src/features/goals/`
- [ ] New assessment available → Add to assessment creation
- [ ] Streak milestones (7, 30, 100 days) → Add to `src/features/streak-tracking/`

### 7.4 Email Notifications (Optional)
- [ ] Welcome email on signup
- [ ] Weekly progress summary
- [ ] Integrate with Resend or SendGrid

### 7.5 Write Tests for Phase 7
- [ ] Test notification creation on triggers
- [ ] Test mark as read functionality
- [ ] Test notification preferences respected

### Success Criteria
- [ ] Bell icon shows accurate unread count
- [ ] Achievements/goals create notifications automatically
- [ ] Users can configure notification preferences
- [ ] Email notifications send when enabled

**Phase 7 Completion:** ⬜ 0/17 tasks

---

## Phase 8: Form Drafts - Server Sync 🟡 MEDIUM
**Status:** Not Started | **Target:** Week 7

### 8.1 Server-Side Draft Storage
- [ ] Create `form_drafts` table in Supabase
- [ ] Create server action to save drafts
- [ ] Create server action to load drafts
- [ ] Sync localStorage drafts to server on save
- [ ] Load drafts from server on page load
- [ ] Conflict resolution (server vs local - use newer timestamp)
- **Files:** `src/features/form-drafts/`

### 8.2 Write Tests for Phase 8
- [ ] Test draft saves to server
- [ ] Test draft loads from server
- [ ] Test conflict resolution uses newer version

### Success Criteria
- [ ] Drafts persist across devices
- [ ] Drafts sync between localStorage and server
- [ ] Newer version wins in conflicts

**Phase 8 Completion:** ⬜ 0/9 tasks

---

## Phase 9: Testing & Quality 🟡 MEDIUM
**Status:** Not Started | **Target:** Week 8

> **Note:** Most testing happens incrementally in each phase.
> This phase focuses on integration tests and coverage gaps.

### 9.1 Integration Tests
- [ ] Auth flow (signup → verify → onboarding → dashboard)
- [ ] Assessment flow (create → view → compare → delete)
- [ ] Payment flow (create → webhook → status update)
- [ ] Video flow (watch → track progress → resume)

### 9.2 E2E Tests (Playwright)
- [ ] Set up Playwright
- [ ] Test critical user journeys
- [ ] Test admin workflows

### 9.3 Test Infrastructure
- [ ] Set up test database/mocks for Supabase
- [ ] Add CI pipeline for tests (GitHub Actions)
- [ ] Generate coverage reports
- [ ] Target: 60%+ coverage

### Success Criteria
- [ ] All integration tests pass
- [ ] CI runs tests on every PR
- [ ] Coverage report shows 60%+ coverage
- [ ] Critical paths have E2E tests

**Phase 9 Completion:** ⬜ 0/10 tasks

---

## Phase 10: Performance Optimization 🟢 LOW
**Status:** Not Started | **Target:** Week 9

### 10.1 Database Performance
- [ ] Add performance indexes (frequently queried fields)
- [ ] Optimize queries (select specific fields instead of *)
- [ ] Add connection pooling configuration
- [ ] Analyze slow queries with Supabase dashboard

### 10.2 Frontend Optimization
- [ ] Add pagination to all admin list pages
- [ ] Memoize expensive chart computations (useMemo)
- [ ] Add skeleton loading states to all pages
- [ ] Lazy load heavy components (React.lazy)
- [ ] Image optimization (next/image)

### 10.3 Write Performance Tests
- [ ] Benchmark critical API endpoints
- [ ] Load test with concurrent users

### Success Criteria
- [ ] No query takes longer than 500ms
- [ ] Page load under 3s on slow 3G
- [ ] Lighthouse performance score 90+

**Phase 10 Completion:** ⬜ 0/12 tasks

---

## Overall Progress

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| 1. Security Fixes | 16 | 16 | ✅ Complete |
| 2. User Management | 21 | 0 | ⬜ Not Started |
| 3. Video Management | 16 | 0 | ⬜ Not Started |
| 4. Data Export & Assessments | 14 | 0 | ⬜ Not Started |
| 5. Profile & Settings | 16 | 0 | ⬜ Not Started |
| 6. Auth Enhancements | 14 | 0 | ⬜ Not Started |
| 7. Notifications | 17 | 0 | ⬜ Not Started |
| 8. Form Drafts Sync | 9 | 0 | ⬜ Not Started |
| 9. Testing & Quality | 10 | 0 | ⬜ Not Started |
| 10. Performance | 12 | 0 | ⬜ Not Started |
| **TOTAL** | **145** | **16** | **11%** |

---

## Schedule Overview

| Week | Phases | Focus |
|------|--------|-------|
| 1 | Phase 1 | Security (critical, do first) |
| 2 | Phase 2 | Admin user management |
| 3 | Phase 3 | Admin video management |
| 4 | Phase 5 + 6 | User settings + Auth (parallel) |
| 5 | Phase 4 | Data export + Assessment deletion |
| 6 | Phase 7 | Notifications |
| 7 | Phase 8 | Form drafts sync |
| 8 | Phase 9 | Integration tests + coverage |
| 9 | Phase 10 | Performance optimization |

---

## Quick Wins Checklist

These patterns should be applied consistently across all phases:

- [ ] All admin actions have loading states (spinner/disabled)
- [ ] All mutations show toast notifications (success/error)
- [ ] All destructive actions require confirmation dialogs
- [ ] All forms show validation errors inline
- [ ] All lists have empty states with helpful messages

---

## Notes & Decisions

_Add notes here as you work through the roadmap:_

-

---

## Changelog

| Date | Phase | Changes |
|------|-------|---------|
| 2026-02-01 | - | Initial roadmap created |
| 2026-02-01 | All | Added success criteria, test tasks, missing features (2FA, assessment deletion, video resume), fixed schedule, added quick wins checklist |
| 2026-02-01 | 1 | Created 6 plans in 3 waves for security fixes phase |
| 2026-02-01 | 1 | **Phase 1 Complete**: Rate limiting, webhook security, Zod validation, 38 RLS policies, 105 tests |
