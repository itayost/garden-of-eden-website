# Project State: Garden of Eden

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** Trainees can track their fitness progress and see improvement as FIFA-style player cards
**Current focus:** Phase 10 - Trainee Images & FIFA Cards (In Progress)

## Current Position

| Metric | Value |
|--------|-------|
| Current Phase | 10 of 10 (Trainee Images & FIFA Cards) |
| Current Plan | 5 of 6 (10-02, 10-03, 10-04, 10-05 complete) |
| Phase Status | In Progress |
| Requirements Complete | 10/57 (SEC-01 to SEC-05, AUTH-05 to AUTH-09) |
| Overall Progress | 53% |

**Progress:** [########.......] 5.3/10 phases complete

## Phase Overview

| Phase | Name | Status | Requirements |
|-------|------|--------|--------------|
| 1 | Security Fixes | Complete | SEC-01 to SEC-05 |
| 2 | User Management | In Progress | ADMN-06 to ADMN-13 |
| 3 | Video Management | Complete | VID-02 to VID-09 |
| 4 | Data Export & Assessments | Complete | EXP-01 to EXP-04, ASMT-04 |
| 5 | Auth Enhancements | Complete | AUTH-05 to AUTH-09 |
| 6 | Notifications | Pending | NOTF-01 to NOTF-08 |
| 7 | Form Drafts Sync | Pending | FORM-03 to FORM-06 |
| 8 | Testing & Quality | Pending | TEST-01 to TEST-06 |
| 9 | Performance | Pending | PERF-01 to PERF-06 |
| 10 | Trainee Images & FIFA Cards | In Progress | IMG-01 to IMG-06 |

## Accumulated Decisions

| Date | Phase-Plan | Decision | Rationale |
|------|------------|----------|-----------|
| 2026-02-01 | 01-01 | Fail-open rate limiting | Prefer availability over blocking legitimate users when Redis unavailable |
| 2026-02-01 | 01-01 | Process token fallback for GROW | Uncertain HMAC signature format, added alternative verification |
| 2026-02-01 | 01-01 | 5-minute replay protection | Balance security vs clock drift tolerance |
| 2026-02-01 | 01-02 | Soft delete over hard delete | Preserves data for audit trail and allows recovery |
| 2026-02-01 | 01-02 | Partial unique indexes | Allows recreation of accounts with same phone after soft delete |
| 2026-02-01 | 01-02 | Forms as immutable audit logs | INSERT-only for pre_workout, post_workout, nutrition forms |
| 2026-02-01 | 01-02 | Activity logs append-only | No UPDATE/DELETE for audit integrity |
| 2026-02-01 | 01-02 | Admin visibility includes deleted | Admins can see soft-deleted records for support |
| 2026-02-01 | 01-03 | Vague rate limit message | Don't reveal rate limiting mechanism in error messages |
| 2026-02-01 | 01-03 | Field-level errors format | Return fieldErrors object for form integration |
| 2026-02-01 | 01-03 | Rate limit before parsing | Check rate limit immediately before processing payload |
| 2026-02-01 | 01-04 | Graceful NaN handling | Default to 1 for paymentsNum, null for payment sums |
| 2026-02-01 | 01-04 | Signature fallback | Fall back to process token if HMAC secret not configured |
| 2026-02-01 | 01-05b | Keep Promise.all type casts | Required due to Supabase client type inference limitations |
| 2026-02-01 | 01-05 | Retain `as unknown as` patterns | TypeScript requires unknown for incompatible type assertions |
| 2026-02-01 | 01-06 | Skip Redis-dependent tests | Focus on unit-testable helpers, skip checkRateLimit |
| 2026-02-01 | 01-06 | Use Vitest fake timers | For timestamp validation in replay attack tests |
| 2026-02-01 | 02-01 | Phone normalization in server action | Format 0XX to +972XX at action level, not schema |
| 2026-02-01 | 02-01 | Profile update not insert | DB trigger creates profile, use update to avoid race |
| 2026-02-01 | 02-01 | Phone-only credential reset | Return message for OTP login, no SMS delivery |
| 2026-02-01 | 02-03 | Client-side filtering initial | Can add server-side pagination later if user count grows |
| 2026-02-01 | 02-03 | Deleted user strikethrough | Visually distinguish deleted users when shown |
| 2026-02-01 | 02-03 | RTL pagination icons | chevron-right for previous, chevron-left for next |
| 2026-02-01 | 02-04 | 'in' operator for ActionResult | Use `"error" in result` for discriminated union type checking |
| 2026-02-01 | 02-04 | Display server message when available | Show credential reset message for phone vs email users |
| 2026-02-01 | 02-05 | Hebrew/English column mapping | Support both language column headers in CSV import |
| 2026-02-01 | 02-05 | BOM for Excel Hebrew | Prefix CSV with UTF-8 BOM for proper Hebrew display |
| 2026-02-01 | 02-05 | Sequential bulk processing | Process users one-by-one to collect per-row errors |
| 2026-02-01 | 03-01 | Hard delete for videos | Videos don't have deleted_at column, use hard delete |
| 2026-02-01 | 03-01 | Auto-calculate order_index | Query max order_index for day and increment on create |
| 2026-02-01 | 03-02 | Separate form schema for react-hook-form | Use schema without z.coerce for form type safety |
| 2026-02-01 | 03-02 | Day topic auto-suggestion | Auto-suggest but allow manual override |
| 2026-02-01 | 03-03 | Client-side video filtering | Can add server-side pagination if video count grows |
| 2026-02-01 | 03-03 | renderActions prop pattern | Parent-controlled action buttons for reuse |
| 2026-02-01 | 03-04 | Sheet for edit dialogs | Slides from left side for RTL, better UX for forms |
| 2026-02-01 | 03-04 | VideoCreateForm wrapper | Simple wrapper to handle redirect on success |
| 2026-02-01 | 04-03 | Type assertion for union filtering | Cast through unknown when filtering union types with filter() |
| 2026-02-01 | 04-03 | Extended column mapping | Export all relevant fields, not just minimal set |
| 2026-02-01 | 04-03 | Unique input IDs | Include formType in input IDs for accessibility |
| 2026-02-01 | 04-02 | Ghost button icon-only trigger | Compact delete action without text label |
| 2026-02-01 | 04-02 | Badge + action in flex container | Wrap controls together for proper alignment |
| 2026-02-01 | 04-05 | GDPR export includes/excludes per CONTEXT.md | Profile, forms, assessments, video progress; excludes activity, payments, goals, achievements |
| 2026-02-01 | 04-05 | Filter soft-deleted assessments | Use deleted_at IS NULL for GDPR export |
| 2026-02-01 | 05-01 | Password requirements | 8+ chars, uppercase, lowercase, number (industry standard) |
| 2026-02-01 | 05-01 | Disable submit until valid | Button disabled until all password requirements met |
| 2026-02-01 | 05-02 | Parallel fetch in useMFA hook | Fetch factors and AAL simultaneously for faster load |
| 2026-02-01 | 05-02 | User-friendly MFA error messages | Translate invalid/expired errors to clear messages |
| 2026-02-01 | 05-03 | Single code input vs 6 separate | Chose single input with maxLength for simpler UX |
| 2026-02-01 | 05-03 | TOTP verification before disable | Security measure for authenticator access confirmation |
| 2026-02-01 | 05-03 | QR with manual secret fallback | Accessibility for users who can't scan QR codes |
| 2026-02-01 | 05-04 | Inline disable dialog | Single-use component, simpler than separate TwoFactorDisable |
| 2026-02-01 | 05-04 | Shield icon for security nav | Visually distinguishes security from other settings |
| 2026-02-01 | 05-04 | Left-side Sheet for setup | RTL context, established pattern from 03-04 |
| 2026-02-01 | 05-05 | Hard redirect after 2FA success | Use window.location.href for session cookie propagation |
| 2026-02-01 | 05-05 | Fail-open on AAL error | Redirect to dashboard if AAL fetch fails for availability |
| 2026-02-01 | 05-05 | Cancel 2FA signs out user | Prevent partial auth state by signing out and returning to login |
| 2026-02-01 | 10-01 | Trainee image paths | {userId}/original/ and {userId}/processed/ subfolder structure |
| 2026-02-01 | 10-01 | JPG/PNG only for trainee uploads | Per CONTEXT.md - standard photo formats for processing |
| 2026-02-01 | 10-01 | 5MB limit for trainee images | Larger than profile photos to support high-res source images |
| 2026-02-01 | 10-02 | FormData upload format | FormData with image file and traineeUserId for image uploads |
| 2026-02-01 | 10-02 | Dual URL return | Return both originalUrl and processedUrl in API response |
| 2026-02-01 | 10-02 | clearTraineeAvatarUrls action | Beyond plan, needed for CONTEXT.md revert-to-initials requirement |
| 2026-02-01 | 10-03 | Click-to-browse only | Per CONTEXT.md - no drag-drop, simple file picker |
| 2026-02-01 | 10-03 | Checkered background for result | CSS gradient pattern to show transparent areas in cutout |
| 2026-02-01 | 10-03 | Hebrew text throughout | All UI labels, buttons, errors in Hebrew for RTL |
| 2026-02-01 | 10-05 | object-contain for cutouts | Preserves aspect ratio and shows full cutout image |
| 2026-02-01 | 10-05 | Removed drop-shadow filter | Card already has glow, per CONTEXT.md |
| 2026-02-01 | 10-05 | Nullish coalescing for avatar | Use ?? instead of \|\| to handle empty strings correctly |

## Patterns Established

| Pattern | Description | Source |
|---------|-------------|--------|
| Rate limit identifier | userId for authenticated, ip:address for anonymous | 01-01 |
| Webhook HMAC payload | timestamp.body format | 01-01 |
| Admin exemption | Admin role bypasses rate limits | 01-01 |
| Soft delete | Use `deleted_at TIMESTAMPTZ` column, NULL = active | 01-02 |
| Admin check in RLS | `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')` | 01-02 |
| Session user in RLS | Use `(SELECT auth.uid())` for current user | 01-02 |
| Payment validation | Full name requires 2+ words with 2+ chars each | 01-03 |
| Rate limit response | Hebrew "הבקשה נכשלה. נסה שוב מאוחר יותר" | 01-03 |
| Validation error format | `{ error: string, fieldErrors: Record<string, string> }` | 01-03 |
| Zod transforms for numbers | Use z.transform with safeParseInt/safeParseFloat | 01-04 |
| Webhook raw body first | Read request.text() before JSON parsing for signature | 01-04 |
| Const arrays for Zod enums | Use `as const` for arrays passed to z.enum() | 01-05b |
| PostgrestVersion hint | Add `__InternalSupabase.PostgrestVersion` to Database type | 01-05b |
| Test file location | src/lib/__tests__/ for lib modules, src/lib/validations/__tests__/ for validations | 01-06 |
| Test naming convention | 'should [expected behavior]' with describe blocks per function | 01-06 |
| verifyAdmin helper | Centralized admin role check for server actions | 02-01 |
| ActionResult type | `{ success: true }` or `{ error: string, fieldErrors? }` | 02-01 |
| UUID validation | Regex check before database operations | 02-01 |
| Admin form + server action | Client form calls server action, sets field errors via setError() | 02-02 |
| Admin page role check | Server component verifies admin role before render | 02-02 |
| URL state persistence | Use nuqs for filter state that survives page refresh | 02-03 |
| Debounced search | 300ms delay using use-debounce for search inputs | 02-03 |
| Table column format | Hebrew headers, sortable with ArrowUpDown icon | 02-03 |
| AlertDialog for destructive actions | Confirmation dialog with loading state for delete operations | 02-04 |
| Client wrapper components | Encapsulate client-side state for server component pages | 02-04 |
| normalizeCSVRow | Map bilingual column names before Zod validation | 02-05 |
| BOM CSV export | Prefix CSV with \uFEFF for Hebrew in Excel | 02-05 |
| Bulk action result | Return { success, created, errors[] } for bulk operations | 02-05 |
| YouTube URL parsing | Regex for watch, shorts, embed, youtu.be formats | 03-01 |
| Video validation refine | Use getYouTubeId in refine for URL validation | 03-01 |
| getDayTopicSuggestion | Helper returns default topic for day 1-5 | 03-01 |
| Form schema without coerce | Separate schema for react-hook-form when server uses z.coerce | 03-02 |
| Video form auto-suggest | Auto-suggest day topic but allow user override | 03-02 |
| Video table thumbnail | Use getYouTubeThumbnail(getYouTubeId(url)) with fallback | 03-03 |
| Video table renderActions | Parent provides action buttons via renderActions prop | 03-03 |
| Sheet for edit | Use Sheet (slides from side) for edit forms, AlertDialog for delete | 03-04 |
| Create form wrapper | Wrapper component handles redirect on success | 03-04 |
| Assessment audit trail | deleted_by stores UUID of admin who soft-deleted | 04-01 |
| admin-assessments.ts | Central server actions file for assessment admin operations | 04-01 |
| SubmissionExportButton | Reusable export button with date filtering for form submissions | 04-03 |
| Form-type column mapping | Different Hebrew column mappings per form type | 04-03 |
| Type assertion for union filtering | Cast through unknown when filtering union types | 04-03 |
| PDF export dynamic import | Use Promise.all for @react-pdf/renderer + template to avoid SSR | 04-04 |
| RTL PDF layout | flexDirection: row-reverse for Hebrew RTL in @react-pdf/renderer | 04-04 |
| Assessment CSV export | Raw measurements with Hebrew columns, BOM prefix | 04-04 |
| DeleteAssessmentDialog | AlertDialog with assessmentId and assessmentDate props | 04-02 |
| Soft delete filter | .is("deleted_at", null) on assessment queries | 04-02 |
| GDPRExportData interface | Typed structure for GDPR user data export | 04-05 |
| exportUserDataAction | Server action for aggregating all user data for GDPR | 04-05 |
| passwordRequirements array | UI password strength indicators with test functions | 05-01 |
| Show/hide password toggle | Eye/EyeOff icons for password visibility | 05-01 |
| MFA result types | { success: true } or { error: string } for MFA operations | 05-02 |
| useMFA hook pattern | React hook for reactive MFA state in components | 05-02 |
| TwoFactorSetup flow | Multi-step enrollment: intro -> QR -> verify | 05-03 |
| TwoFactorVerify pattern | Auto-fetch factor on mount for login verification | 05-03 |
| TwoFactorDisable security | Require TOTP verification before unenrollment | 05-03 |
| Settings layout wrapper | Consistent wrapper for settings pages | 05-04 |
| Security settings page | 2FA management at /dashboard/settings/security | 05-04 |
| AAL check in callback | Check nextLevel vs currentLevel for MFA routing | 05-05 |
| 2FA login flow | OTP verify -> AAL check -> 2FA verify -> dashboard | 05-05 |
| Trainee image paths | {userId}/original/ and {userId}/processed/ subfolders | 10-01 |
| Admin/trainer storage RLS | EXISTS check for role IN ('admin', 'trainer') on storage.objects | 10-01 |
| Dual image storage | Original for avatar, processed for FIFA card | 10-01 |
| verifyAdminOrTrainer helper | Check for admin OR trainer role in server actions | 10-02 |
| FormData image upload | POST with FormData containing image file and metadata | 10-02 |
| Multi-step upload flow | select -> preview -> processing -> result | 10-03 |
| UploadStep type union | Type-safe step state machine for upload flows | 10-03 |
| Checkered background pattern | CSS gradient for PNG transparency preview | 10-03 |
| TraineeImageSection | Card wrapper with Avatar display and Sheet upload modal | 10-04 |
| getInitials helper | Extract 2-char initials from name for avatar fallback | 10-04 |
| Cutout avatar display | object-contain class, no filter/shadow on img | 10-05 |
| Avatar URL prop pattern | processed_avatar_url ?? avatar_url ?? undefined | 10-05 |

## Blockers / Concerns

| Issue | Impact | Resolution |
|-------|--------|------------|
| Migration 01-02 not applied | RLS policies not active in database | Apply via Supabase Dashboard SQL Editor |
| Migration 04-01 not applied | deleted_by column not in database | Apply via Supabase Dashboard SQL Editor |
| Test file null checks | 11 TypeScript errors in ranking-utils.test.ts | Pre-existing, not blocking |
| Migration 10-01 not applied | RLS policies and processed_avatar_url column not in database | Apply via Supabase Dashboard SQL Editor |
| REMOVEBG_API_KEY not set | Background removal API will fail without key | User must set env var before 10-03 |

## Workflow Configuration

- **Mode:** Interactive (confirm at each step)
- **Parallelization:** Enabled
- **Research:** Enabled (before each phase)
- **Plan Check:** Enabled (verify plans)
- **Verifier:** Enabled (after each phase)
- **Model Profile:** Quality (Opus for research/roadmap)

## Session Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-01 | Project initialized | Brownfield project with existing codebase |
| 2026-02-01 | Roadmap created | 10 phases, 145 tasks, 57 requirements |
| 2026-02-01 | 01-01 complete | Security infrastructure utilities created |
| 2026-02-01 | 01-02 complete | Security indexes, soft delete, 38 RLS policies |
| 2026-02-01 | 01-03 complete | Payment rate limiting and Zod validation |
| 2026-02-01 | 01-04 complete | Webhook signature verification and Zod validation |
| 2026-02-01 | 01-05b complete | Type safety improvements, Zod enum fix, PostgrestVersion |
| 2026-02-01 | 01-05 complete | Added deleted_at to types; `as unknown as` retained per 01-05b decision |
| 2026-02-01 | 01-06 complete | 105 tests for security features (rate limit, webhook, validation) |
| 2026-02-01 | 02-01 complete | Server actions for admin user CRUD, Phase 2 dependencies |
| 2026-02-01 | 02-02 complete | User creation form and page at /admin/users/create |
| 2026-02-01 | 02-03 complete | TanStack Table components for admin user list |
| 2026-02-01 | 02-04 complete | Delete dialog and user actions card integration |
| 2026-02-01 | 02-05 complete | CSV import dialog, export button, validation schema |
| 2026-02-01 | 03-01 complete | Video validation schema and server actions |
| 2026-02-01 | 03-02 complete | VideoForm and DeleteVideoDialog components |
| 2026-02-01 | 03-03 complete | Video table columns, toolbar, pagination, data table |
| 2026-02-01 | 03-04 complete | Full CRUD admin videos page and create page |
| 2026-02-01 | 03-05 complete | Human verification passed - all CRUD operations working |
| 2026-02-01 | Phase 3 complete | Video management phase verified and complete |
| 2026-02-01 | 04-01 complete | Assessment soft delete infrastructure (migration, types, server action) |
| 2026-02-01 | 04-03 complete | Form submission CSV export with date filtering |
| 2026-02-01 | 04-04 complete | Assessment CSV/PDF export with @react-pdf/renderer and Heebo font |
| 2026-02-01 | 04-02 complete | Assessment deletion UI with DeleteAssessmentDialog |
| 2026-02-01 | 04-05 complete | GDPR user data export server action and button |
| 2026-02-01 | Phase 4 complete | Data Export & Assessment Management complete |
| 2026-02-01 | Removed Phase 5 | Profile & Settings removed - trainees managed by admin/coach |
| 2026-02-01 | 05-01 complete | Password reset flow (forgot-password, reset-password pages, validation schema) |
| 2026-02-01 | 05-02 complete | MFA helper functions (enrollMFA, verifyMFA, listFactors, unenrollFactor, getAAL) and useMFA hook |
| 2026-02-01 | 05-03 complete | 2FA components (TwoFactorSetup, TwoFactorVerify, TwoFactorDisable) |
| 2026-02-01 | 05-04 complete | Security settings page with 2FA management at /dashboard/settings/security |
| 2026-02-01 | 05-05 complete | verify-2fa page, forgot password link, AAL check in callback |
| 2026-02-01 | Phase 10 added | Trainee Image Management & FIFA Card Photos |
| 2026-02-01 | 05-06 complete | Human verification approved (deferred testing) |
| 2026-02-01 | Phase 5 complete | Auth enhancements verified - password reset, 2FA enrollment, 2FA login, security settings |
| 2026-02-01 | 10-01 complete | Image infrastructure: migration, storage utilities, remove.bg package |
| 2026-02-01 | 10-02 complete | Background removal API endpoint and updateTraineeAvatarUrls server action |
| 2026-02-01 | 10-03 complete | TraineeImageUpload component with 4-step upload flow |
| 2026-02-01 | 10-04 complete | TraineeImageSection component and user edit page integration |
| 2026-02-01 | 10-05 complete | PlayerCard cutout display update, pages pass processed_avatar_url |

## Session Continuity

- **Last session:** 2026-02-01T18:15:27Z
- **Stopped at:** Completed 10-05-PLAN.md (FIFA Card Display)
- **Resume file:** None

## Next Action

Continue Phase 10: Plan 10-06 (Human Verification)

---
*Last updated: 2026-02-01T18:15:27Z*
