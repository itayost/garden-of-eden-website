---
phase: 10
plan: 01
subsystem: trainee-images
tags: [storage, database, infrastructure, remove.bg]

dependency-graph:
  requires: []
  provides:
    - processed_avatar_url column in profiles table
    - RLS policies for admin/trainer image uploads
    - storage utilities for trainee image management
    - remove.bg package for background removal
  affects:
    - 10-02 (upload UI uses storage utilities)
    - 10-03 (background removal uses remove.bg)
    - 10-04 (FIFA cards use processed_avatar_url)

tech-stack:
  added:
    - remove.bg@1.3.0
  patterns:
    - Trainee images stored in {userId}/original/ and {userId}/processed/ paths
    - RLS policies for storage.objects on avatars bucket
    - Dual image storage (original for avatar, processed for FIFA card)

key-files:
  created:
    - supabase/migrations/20260201175723_trainee_images_infrastructure.sql
  modified:
    - src/lib/utils/storage.ts
    - package.json
    - package-lock.json

decisions:
  - id: trainee-image-paths
    choice: "{userId}/original/ and {userId}/processed/ subfolder structure"
    rationale: "Keeps original and processed images organized per trainee"
  - id: jpg-png-only
    choice: "JPG and PNG only for trainee uploads (not WebP)"
    rationale: "Per CONTEXT.md - standard photo formats for processing"
  - id: 5mb-limit
    choice: "5MB max file size for trainee images"
    rationale: "Per CONTEXT.md - larger than profile photos to support high-res source images"

metrics:
  tasks: 3
  commits: 3
  duration: ~3 minutes
  completed: 2026-02-01
---

# Phase 10 Plan 01: Image Infrastructure Summary

**One-liner:** Storage policies, processed_avatar_url column, and remove.bg package for trainee image management foundation

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 0f9b01c | feat | Database migration with processed_avatar_url column and 4 RLS policies |
| 5f1a83a | feat | Extended storage.ts with trainee image upload/delete functions |
| c3d175a | chore | Install remove.bg package for background removal API |

## What Was Built

### 1. Database Migration (Task 1)
Created migration file `20260201175723_trainee_images_infrastructure.sql`:
- Added `processed_avatar_url TEXT` column to profiles table
- Created 4 RLS policies on `storage.objects` for `avatars` bucket:
  - INSERT policy for admins/trainers
  - UPDATE policy for admins/trainers
  - DELETE policy for admins/trainers
  - SELECT policy for all authenticated users

### 2. Storage Utilities (Task 2)
Extended `src/lib/utils/storage.ts` with new functions:
- `uploadTraineeImage(traineeUserId, file)` - uploads to `{userId}/original/`
- `uploadProcessedImage(traineeUserId, imageBuffer, format)` - uploads to `{userId}/processed/`
- `deleteTraineeImage(originalPath, processedPath?)` - deletes both images
- `getProcessedAvatarUrl(path)` - returns public URL for processed image

Added constants:
- `MAX_TRAINEE_IMAGE_SIZE` = 5MB
- `TRAINEE_ALLOWED_MIME_TYPES` = ['image/jpeg', 'image/png']

### 3. remove.bg Package (Task 3)
Installed `remove.bg@1.3.0` for background removal API.

**Note:** REMOVEBG_API_KEY environment variable documented in `.env.local.example` (gitignored). Users must obtain API key from https://www.remove.bg/dashboard#api-key

## Deviations from Plan

None - plan executed exactly as written.

## Known Issues

- Pre-existing TypeScript errors in test files (ranking-utils.test.ts) - not related to this plan
- Deprecation warnings in remove.bg dependencies (har-validator, uuid, request) - upstream issue

## Verification Results

| Check | Status |
|-------|--------|
| Migration file exists | Pass |
| Migration has valid SQL | Pass |
| storage.ts exports new functions | Pass |
| remove.bg installed | Pass |
| TypeScript compiles (storage.ts) | Pass |

## Next Phase Readiness

Ready for 10-02 (Image Upload UI):
- Storage utilities available for upload operations
- RLS policies in place for admin/trainer uploads
- processed_avatar_url column ready for storing cutout URLs

**Required user setup before 10-03:**
- Set REMOVEBG_API_KEY environment variable
- Create remove.bg account if needed
