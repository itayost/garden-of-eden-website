---
phase: 10
plan: 02
subsystem: api
tags: [remove.bg, background-removal, image-processing, server-actions, storage]

dependency-graph:
  requires:
    - phase: 10-01
      provides: storage utilities, remove.bg package, processed_avatar_url column
  provides:
    - Background removal API endpoint at /api/images/process-background
    - Server action updateTraineeAvatarUrls for profile updates
    - Server action clearTraineeAvatarUrls for reverting to initials
    - verifyAdminOrTrainer helper for auth in image operations
  affects:
    - 10-03 (Image Upload UI will call this API endpoint)
    - 10-04 (FIFA cards will use processed_avatar_url set by this action)

tech-stack:
  added: []
  patterns:
    - FormData POST for image uploads with traineeUserId
    - Dual storage (original + processed) with URL return
    - verifyAdminOrTrainer accepts both admin and trainer roles
    - ActionResult pattern for server actions

key-files:
  created:
    - src/app/api/images/process-background/route.ts
    - src/lib/actions/admin-images.ts
  modified: []

decisions:
  - id: formdata-upload
    choice: "FormData with image file and traineeUserId"
    rationale: "Standard pattern for file uploads, supports both image and metadata"
  - id: dual-url-return
    choice: "Return both originalUrl and processedUrl in API response"
    rationale: "Caller needs both for profile update and preview display"
  - id: clear-avatars-action
    choice: "Add clearTraineeAvatarUrls action (beyond plan)"
    rationale: "Needed for delete/revert functionality per CONTEXT.md 'revert to initials'"

metrics:
  tasks: 2
  commits: 2
  duration: 3min
  completed: 2026-02-01
---

# Phase 10 Plan 02: Background Removal API Summary

**POST /api/images/process-background endpoint with remove.bg integration and updateTraineeAvatarUrls server action for profile updates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-01T18:02:20Z
- **Completed:** 2026-02-01T18:05:27Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- API endpoint for background removal with role verification (admin/trainer)
- Image validation (JPEG/PNG only, 5MB max per CONTEXT.md)
- Dual storage: original in `{userId}/original/`, processed in `{userId}/processed/`
- Server actions for updating and clearing trainee avatar URLs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create background removal API endpoint** - `d586964` (feat)
2. **Task 2: Create server action for updating profile avatar URLs** - `1b53a88` (feat)

## Files Created

- `src/app/api/images/process-background/route.ts` - API endpoint that accepts image + traineeUserId, removes background via remove.bg, uploads both versions to storage, returns URLs
- `src/lib/actions/admin-images.ts` - Server actions for updateTraineeAvatarUrls and clearTraineeAvatarUrls with verifyAdminOrTrainer helper

## Decisions Made

1. **FormData upload format** - API accepts FormData with `image` (File) and `traineeUserId` (string) fields, standard pattern for multipart uploads

2. **Dual URL return** - API returns `{ originalUrl, processedUrl, originalPath, processedPath }` so caller has everything needed for preview and profile update

3. **Added clearTraineeAvatarUrls** - Beyond plan scope but needed for CONTEXT.md requirement "revert to initials default when photo is deleted"

4. **Activity logging** - Both updateTraineeAvatarUrls and clearTraineeAvatarUrls log to activity_logs for audit trail

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added clearTraineeAvatarUrls action**
- **Found during:** Task 2 (server action creation)
- **Issue:** CONTEXT.md specifies "revert to initials default when photo is deleted" but plan only has updateTraineeAvatarUrls
- **Fix:** Added clearTraineeAvatarUrls function to set both avatar_url and processed_avatar_url to null
- **Files modified:** src/lib/actions/admin-images.ts
- **Verification:** Function compiles and follows same pattern as update function
- **Committed in:** 1b53a88 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for delete functionality specified in CONTEXT.md. No scope creep.

## Issues Encountered

None - execution proceeded smoothly.

## User Setup Required

**REMOVEBG_API_KEY must be configured before using this endpoint.**

See 10-01-SUMMARY.md for API key setup:
1. Create account at https://www.remove.bg
2. Get API key from https://www.remove.bg/dashboard#api-key
3. Add `REMOVEBG_API_KEY=your_key` to `.env.local`

## Next Phase Readiness

Ready for 10-03 (Image Upload UI):
- API endpoint available at POST /api/images/process-background
- Server action updateTraineeAvatarUrls ready for profile updates
- Response format defined: { originalUrl, processedUrl, originalPath, processedPath }
- Error responses: 400 (validation), 403 (auth), 429 (rate limit), 500 (processing)

---
*Phase: 10-trainee-images-fifa-cards*
*Completed: 2026-02-01*
