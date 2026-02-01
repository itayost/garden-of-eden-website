---
phase: 10-trainee-images-fifa-cards
plan: 05
subsystem: ui
tags: [player-card, fifa-card, avatar, cutout, transparency]

# Dependency graph
requires:
  - phase: 10-01
    provides: processed_avatar_url column in profiles table
  - phase: 10-04
    provides: TraineeImageSection for uploading/processing images
provides:
  - PlayerCard component updated for transparent cutout display
  - Dashboard and assessments pages passing processed avatar URL
  - Profile type includes processed_avatar_url field
affects: [10-06-human-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cutout image display: object-contain without filters for transparent PNG"
    - "Avatar URL fallback pattern: processed_avatar_url ?? avatar_url ?? undefined"

key-files:
  created: []
  modified:
    - src/components/player-card/PlayerCard.tsx
    - src/app/dashboard/page.tsx
    - src/app/dashboard/assessments/page.tsx
    - src/app/admin/assessments/[userId]/page.tsx
    - src/types/database.ts

key-decisions:
  - "object-contain for cutouts: Preserves aspect ratio and shows full cutout image"
  - "Removed drop-shadow filter: Card already has glow, per CONTEXT.md"
  - "Nullish coalescing for avatar: Use ?? instead of || to handle empty strings correctly"

patterns-established:
  - "Cutout avatar display: object-contain class, no filter/shadow on img"
  - "Avatar URL prop pattern: processed_avatar_url ?? avatar_url ?? undefined"

# Metrics
duration: 2min
completed: 2026-02-01
---

# Phase 10 Plan 05: FIFA Card Cutout Display Summary

**PlayerCard updated for transparent cutout images with fallback to regular avatar URL on all pages**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-01T18:13:02Z
- **Completed:** 2026-02-01T18:15:27Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- PlayerCard component displays cutout images with `object-contain` for proper sizing
- Removed drop-shadow filter per CONTEXT.md (card already has glow effect)
- Dashboard, assessments, and admin assessment pages all pass processed avatar URL
- Added `processed_avatar_url` to Profile TypeScript type

## Task Commits

Each task was committed atomically:

1. **Task 1: Update PlayerCard for processed cutout images** - `5df9c6b` (feat)
2. **Task 2: Update dashboard and assessments pages to pass processed URL** - `180183a` (feat)

## Files Created/Modified

- `src/components/player-card/PlayerCard.tsx` - Changed to object-contain, removed drop-shadow filter
- `src/app/dashboard/page.tsx` - Added avatarUrl prop with processed_avatar_url fallback
- `src/app/dashboard/assessments/page.tsx` - Added avatarUrl prop (2 instances: progress and history tabs)
- `src/app/admin/assessments/[userId]/page.tsx` - Added avatarUrl prop for admin card preview
- `src/types/database.ts` - Added processed_avatar_url to Profile Row/Insert/Update types

## Decisions Made

1. **object-contain for cutouts:** Preserves aspect ratio and shows full cutout instead of cropping
2. **Removed drop-shadow filter:** Per CONTEXT.md, card already has glow effect - no additional shadow needed on image
3. **Nullish coalescing operator:** Used `??` instead of `||` to correctly handle null vs undefined conversion for prop types

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added processed_avatar_url to Profile type**
- **Found during:** Task 2 (Updating pages to pass processed URL)
- **Issue:** TypeScript error - `processed_avatar_url` not in Profile type despite being in 10-01 migration
- **Fix:** Added processed_avatar_url: string | null to Row, Insert, and Update types
- **Files modified:** src/types/database.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 180183a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking type missing)
**Impact on plan:** Type was supposed to exist from 10-01 migration but wasn't added to TypeScript types. No scope creep.

## Issues Encountered

None - straightforward implementation after type fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PlayerCard now displays processed cutout images with transparency
- Card background/gradient shows through transparent PNG areas
- Ready for 10-06 human verification of complete image upload flow

---
*Phase: 10-trainee-images-fifa-cards*
*Completed: 2026-02-01*
