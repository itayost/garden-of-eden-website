# Arbox User Sync — Design Document

**Date:** 2026-03-08
**Status:** Approved

## Overview

Nightly cron job that pulls all members from Arbox (`GET /v3/users`) and syncs them into the Garden of Eden Supabase `profiles` table. New Arbox members get full trainee accounts (WhatsApp OTP login). Existing profiles are enriched with missing data only — our DB wins on conflicts.

## Data Model

### New column on `profiles`

```sql
ALTER TABLE profiles ADD COLUMN arbox_user_id INTEGER UNIQUE;
CREATE INDEX idx_profiles_arbox_user_id ON profiles(arbox_user_id);
```

`arbox_user_id` is Arbox's internal integer `user_id`. It is the permanent link between systems — used for sync identity now, and available for future Arbox API calls (booking, messaging) without re-lookup.

### Field mapping

| Arbox field | profiles column | Rule |
|---|---|---|
| `user_id` | `arbox_user_id` | Always set when linking |
| `full_name` | `full_name` | Only if our value is null/empty |
| `birthday` | `birthdate` | Only if our value is null |
| `phone` | — | Match key only, never overwritten |

Gender, address, city are skipped — no corresponding columns exist in `profiles`.

## Sync Logic

```
For each Arbox user (paginated, 500/page):

  1. Normalize phone
     - Strip spaces, dashes, parentheses
     - Convert 05x → +9725x (Israeli E.164)

  2. Look up profile by phone OR arbox_user_id

  3a. Profile found, arbox_user_id is null:
      → SET arbox_user_id = arbox.user_id
      → Fill null full_name, birthdate

  3b. Profile found, already linked:
      → Fill null full_name, birthdate only

  3c. No profile found:
      → supabase.auth.admin.createUser({ phone })
        (on_auth_user_created trigger auto-creates profile row)
      → UPDATE profile SET arbox_user_id, full_name, birthdate

  4. Accumulate: created / updated / skipped / errors
```

**Error isolation:** failure on a single user is logged and skipped — the sync continues. The overall sync does not abort on individual errors.

**New users:** role defaults to `trainee`. No password. Login via WhatsApp OTP.

**Location filtering:** not needed — single Arbox location, no `location_id` param required.

## New Files

| File | Purpose |
|---|---|
| `src/lib/arbox/client.ts` | Typed Arbox API client with pagination helper |
| `src/app/api/cron/arbox-sync/route.ts` | Cron route handler |
| `supabase/migrations/TIMESTAMP_add_arbox_user_id.sql` | DB migration |

## API Route

- **Path:** `GET /api/cron/arbox-sync`
- **Auth:** `Authorization: Bearer CRON_SECRET` (existing pattern)
- **Response:** `{ created: number, updated: number, skipped: number, errors: number }`

## Scheduling

Added to `vercel.json`:
```json
{ "path": "/api/cron/arbox-sync", "schedule": "0 2 * * *" }
```

Runs nightly at 2am UTC.

## Environment Variables

| Variable | Scope | Description |
|---|---|---|
| `ARBOX_API_KEY` | Server only | Arbox API key — never exposed to client |
| `CRON_SECRET` | Server only | Already exists — protects cron routes |

## Trade-offs Considered

| Approach | Decision |
|---|---|
| Next.js cron route vs Supabase Edge Function | Next.js — consistent with existing `/api/cron/*` pattern |
| Arbox wins vs our DB wins on conflict | Our DB wins — Arbox is discovery, not source of truth for profile data |
| Create auth users vs staging table | Create auth users — full accounts immediately |
| Log to DB vs console | Console only for now — add a log table if operational need arises |
