# Requirements: Garden of Eden

**Defined:** 2026-02-01
**Core Value:** Trainees can track their fitness progress through assessments and see their improvement visualized as a FIFA-style player card

## v1 Requirements

Requirements for production launch. Each maps to roadmap phases.

### Security

- [ ] **SEC-01**: Rate limiting middleware for all API endpoints
- [ ] **SEC-02**: GROW webhook signature verification with replay protection
- [ ] **SEC-03**: Replace all `as unknown as` patterns with Zod validation
- [ ] **SEC-04**: UPDATE/DELETE RLS policies on all critical tables
- [ ] **SEC-05**: Soft delete pattern for users and assessments

### Admin - User Management

- [ ] **ADMN-06**: Admin can create new users with welcome credentials
- [ ] **ADMN-07**: Admin can soft-delete users (preserves data)
- [ ] **ADMN-08**: Admin can reset user passwords via Supabase Admin API
- [ ] **ADMN-09**: Admin can search users by name, email, phone
- [ ] **ADMN-10**: Admin can filter users by role, status, position
- [ ] **ADMN-11**: Admin can paginate user list with sorting
- [ ] **ADMN-12**: Admin can bulk import users via CSV
- [ ] **ADMN-13**: Admin can bulk export users to CSV/Excel

### Admin - Video Management

- [ ] **VID-02**: Admin can create videos (title, YouTube URL, day, topic)
- [ ] **VID-03**: Admin can edit existing videos
- [ ] **VID-04**: Admin can delete videos with confirmation
- [ ] **VID-05**: Admin can reorder videos via drag-and-drop
- [ ] **VID-06**: Admin can view video analytics (views, completion rates)

### Admin - Data Export

- [ ] **EXP-01**: Export form submissions to CSV/Excel with date filtering
- [ ] **EXP-02**: Export user assessments to CSV/Excel
- [ ] **EXP-03**: Export assessments to PDF with charts
- [ ] **EXP-04**: GDPR-compliant full data export per user

### Admin - Assessment Management

- [ ] **ASMT-04**: Admin can delete assessments (soft delete with audit)

### User - Profile & Settings

- [ ] **PROF-01**: Users can access settings page from dashboard
- [ ] **PROF-02**: Users can edit name, birthdate, position after onboarding
- [ ] **PROF-03**: Users can upload/change/delete avatar
- [ ] **PROF-04**: Users can change phone number with OTP verification
- [ ] **PROF-05**: Users can delete their account with confirmation
- [ ] **PROF-06**: Users can download their data (GDPR export)
- [ ] **PROF-07**: Users can set notification preferences

### User - Authentication

- [ ] **AUTH-05**: Forgot password link on login page
- [ ] **AUTH-06**: Password reset via email/phone OTP
- [ ] **AUTH-07**: 2FA setup with TOTP (Google Authenticator)
- [ ] **AUTH-08**: 2FA backup codes generation
- [ ] **AUTH-09**: 2FA verification on login when enabled

### User - Video Experience

- [ ] **VID-07**: Track video watch duration (not just binary)
- [ ] **VID-08**: Save playback position for resume
- [ ] **VID-09**: Show "Continue watching" for partial views

### Notifications

- [ ] **NOTF-01**: Notification bell in navbar with unread count
- [ ] **NOTF-02**: Notification dropdown panel
- [ ] **NOTF-03**: Mark notifications as read (individual/all)
- [ ] **NOTF-04**: Notification center page
- [ ] **NOTF-05**: Achievement unlocked triggers notification
- [ ] **NOTF-06**: Goal achieved triggers notification
- [ ] **NOTF-07**: Streak milestone triggers notification (7, 30, 100 days)
- [ ] **NOTF-08**: Email notifications when enabled (optional)

### Form Drafts

- [ ] **FORM-03**: Server-side draft storage table
- [ ] **FORM-04**: Sync localStorage drafts to server
- [ ] **FORM-05**: Load drafts from server on page load
- [ ] **FORM-06**: Conflict resolution (newer timestamp wins)

### Testing & Quality

- [ ] **TEST-01**: Integration tests for auth flow
- [ ] **TEST-02**: Integration tests for assessment flow
- [ ] **TEST-03**: Integration tests for payment flow
- [ ] **TEST-04**: E2E tests with Playwright
- [ ] **TEST-05**: CI pipeline runs tests on every PR
- [ ] **TEST-06**: Coverage reports with 60%+ target

### Performance

- [ ] **PERF-01**: Performance indexes on frequently queried fields
- [ ] **PERF-02**: Optimize SELECT queries (specific fields, not *)
- [ ] **PERF-03**: Pagination on all admin list pages
- [ ] **PERF-04**: Memoize expensive chart computations
- [ ] **PERF-05**: Lazy load heavy components
- [ ] **PERF-06**: Lighthouse performance score 90+

## v2 Requirements

Deferred to future release. Not in current roadmap.

### Advanced Features

- **ADV-01**: Real-time chat between trainers and trainees
- **ADV-02**: Workout plan builder for trainers
- **ADV-03**: Nutrition/diet tracking integration
- **ADV-04**: Mobile native app (iOS/Android)
- **ADV-05**: OAuth login providers (Google, Apple)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time chat | High complexity, not core to fitness tracking |
| Custom workout builder | Trainers manage programming externally |
| Diet/nutrition tracking | Outside current product focus |
| Mobile native app | Web-first, evaluate after launch |
| OAuth login | Email/password works for gym context |
| SMS notifications | Email sufficient for v1, SMS adds cost |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| SEC-04 | Phase 1 | Pending |
| SEC-05 | Phase 1 | Pending |
| ADMN-06 | Phase 2 | Pending |
| ADMN-07 | Phase 2 | Pending |
| ADMN-08 | Phase 2 | Pending |
| ADMN-09 | Phase 2 | Pending |
| ADMN-10 | Phase 2 | Pending |
| ADMN-11 | Phase 2 | Pending |
| ADMN-12 | Phase 2 | Pending |
| ADMN-13 | Phase 2 | Pending |
| VID-02 | Phase 3 | Pending |
| VID-03 | Phase 3 | Pending |
| VID-04 | Phase 3 | Pending |
| VID-05 | Phase 3 | Pending |
| VID-06 | Phase 3 | Pending |
| VID-07 | Phase 3 | Pending |
| VID-08 | Phase 3 | Pending |
| VID-09 | Phase 3 | Pending |
| EXP-01 | Phase 4 | Pending |
| EXP-02 | Phase 4 | Pending |
| EXP-03 | Phase 4 | Pending |
| EXP-04 | Phase 4 | Pending |
| ASMT-04 | Phase 4 | Pending |
| PROF-01 | Phase 5 | Pending |
| PROF-02 | Phase 5 | Pending |
| PROF-03 | Phase 5 | Pending |
| PROF-04 | Phase 5 | Pending |
| PROF-05 | Phase 5 | Pending |
| PROF-06 | Phase 5 | Pending |
| PROF-07 | Phase 5 | Pending |
| AUTH-05 | Phase 6 | Pending |
| AUTH-06 | Phase 6 | Pending |
| AUTH-07 | Phase 6 | Pending |
| AUTH-08 | Phase 6 | Pending |
| AUTH-09 | Phase 6 | Pending |
| NOTF-01 | Phase 7 | Pending |
| NOTF-02 | Phase 7 | Pending |
| NOTF-03 | Phase 7 | Pending |
| NOTF-04 | Phase 7 | Pending |
| NOTF-05 | Phase 7 | Pending |
| NOTF-06 | Phase 7 | Pending |
| NOTF-07 | Phase 7 | Pending |
| NOTF-08 | Phase 7 | Pending |
| FORM-03 | Phase 8 | Pending |
| FORM-04 | Phase 8 | Pending |
| FORM-05 | Phase 8 | Pending |
| FORM-06 | Phase 8 | Pending |
| TEST-01 | Phase 9 | Pending |
| TEST-02 | Phase 9 | Pending |
| TEST-03 | Phase 9 | Pending |
| TEST-04 | Phase 9 | Pending |
| TEST-05 | Phase 9 | Pending |
| TEST-06 | Phase 9 | Pending |
| PERF-01 | Phase 10 | Pending |
| PERF-02 | Phase 10 | Pending |
| PERF-03 | Phase 10 | Pending |
| PERF-04 | Phase 10 | Pending |
| PERF-05 | Phase 10 | Pending |
| PERF-06 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 57 total
- Mapped to phases: 57
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-01*
*Last updated: 2026-02-01 after initialization*
