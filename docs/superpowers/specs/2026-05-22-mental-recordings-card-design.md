# Mental Session Recordings Card — Design

**Date:** 2026-05-22
**Status:** Approved

## Goal

Add a card to the trainee dashboard that lets trainees reach the recordings of
past mental ("zoom meetup") sessions. The recordings live in a public Google
Drive folder; the card opens that folder in a new browser tab.

## Scope

In scope:

- One new presentational component.
- One integration point in the existing dashboard page.

Out of scope:

- No dedicated in-app page or recordings list.
- No data fetching, database changes, or migrations.
- No admin UI for managing recordings — they are managed entirely in Drive.

## Approach

Direct external link. The card is a static card whose action button is an
anchor to the Drive folder, opened in a new tab. No new route, no server work.

## Component

**File:** `src/components/dashboard/MentalRecordingsCard.tsx`

- Plain presentational component. No `"use client"`, no props, no data
  fetching, no state.
- Module-level named constant `MENTAL_RECORDINGS_DRIVE_URL` holds the Drive
  folder URL. The `?hl=he` tracking query param is stripped; the clean folder
  URL is used:
  `https://drive.google.com/drive/folders/1Pl8dGFPfqHY-wZ-AKVdgtuvzhZ4n4WzK`
- Layout mirrors the existing "Nutrition Alert" / `NextGameCard` empty-state
  card: a colored icon tile + title + description on one side, an action
  button on the other; stacks vertically on mobile (`flex-col sm:flex-row`).
- Content (Hebrew, RTL):
  - Icon: `Brain` from `lucide-react`, inside a `bg-indigo-500` rounded tile
    (distinct from existing card colors: blue, green, orange, purple, amber).
  - Title: `הקלטות מפגשי מנטל`
  - Description: `צפו בהקלטות ממפגשי הזום הקודמים בנושא מנטליות`
  - Button (`Button asChild`): label `לצפייה בהקלטות` with an `ExternalLink`
    icon, wrapping `<a href={MENTAL_RECORDINGS_DRIVE_URL} target="_blank"
    rel="noopener noreferrer">`.
- Uses logical spacing utilities consistent with the surrounding RTL code.

## Integration

**File:** `src/app/dashboard/page.tsx`

- Import `MentalRecordingsCard`.
- Render `<MentalRecordingsCard />` immediately after `<ClipUploadCard />` and
  before the "Quick Actions" (`פעולות מהירות`) section.

## Error Handling

None required. The component renders static markup; the only failure mode is
an unreachable Drive folder, which is outside the application's control.

## Security

- The anchor uses `target="_blank"` with `rel="noopener noreferrer"`.
- The Drive folder is set to "anyone with the link can view". This is a
  conscious, accepted choice: the recordings are not behind app auth, so anyone
  who obtains the URL can view them. No secrets are involved; the URL is not an
  env var.

## Testing

No automated tests. Per the project convention, tests cover pure utility
functions only; this is a static presentational component with no logic.
Manual check: card renders on `/dashboard`, button opens the Drive folder in a
new tab, layout is correct in RTL at mobile and desktop widths.
