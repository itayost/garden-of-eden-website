# Player Report PDF Redesign

**Date:** 2026-03-12
**Status:** Approved
**Feature:** `src/features/player-report`

---

## Overview

Redesign the player report PDF from a plain multi-column layout to a professional dark scout-report style, inspired by professional football scouting platforms.

---

## Design Decisions

- **Style:** Dark background (`#111827`), green accent (`#22c55e`), white text — scout report aesthetic
- **Pages:** 2 pages (down from 3)
- **FIFA card:** Captured via `html-to-image` from the existing `PlayerCard` component, embedded as a base64 image in the PDF header

---

## Page 1 — Profile + Summary + Assessments

### Header
- Player name: large, bold, uppercase, white
- Meta strip: chips for academy name, age (from birthdate), club/team, join date (`profile.created_at`), weekly attendance
- FIFA card image (top-right): ~110×154px, captured from a hidden `PlayerCard` on the page

### Body (two columns)
**Left column (130px)** — key stats with large bold numbers:

- Overall rating (44px, green) — from `stats.overall_rating`
- Best sprint result (sprint_10m or sprint_5m, whichever exists)
- Best jump result (jump_2leg_height)
- Kick power (kick_power_kaiser)
- Weekly attendance average

**Right column** — narrative:

- Summary text (2 paragraphs from `summary`)
- Bullets row: Strengths (green) / Areas to improve (amber) / Social skills (indigo)

### Assessment Table

- Full width, below the two-column body
- Columns: metric name | latest value | previous value
- **Improvement highlighting:** green if latest is better than previous; amber if worse or stagnant
  - Lower is better: all sprint metrics
  - Higher is better: all jump, kick power, flexibility metrics
  - Categorical: `coordination`, `body_structure`, `leg_power_technique` — no highlight (show as-is)
- Shows up to the 2 most recent assessments per row

### Footer
Academy name (right), page number (center), date (left)

---

## Page 2 — Progress Analysis

### Header
Player name + "ניתוח התקדמות", date

### Layout
Two separate captured images, stacked vertically:

1. **`radarRef`** — captures `RadarStatsChart` (existing, no change)
2. **`trendsRef`** — captures the full `AssessmentProgressCharts` component, which already contains both the overall rating trend line (`RatingTrendChart`) and the per-metric progress charts (`PhysicalMetricChart`). This is one image covering both sections.

No new refs are needed. The existing two refs are sufficient.

### Footer
Same as page 1.

---

## Data Requirements

### New fields needed in `ReportData`

**`profile` object** — add:

- `processed_avatar_url: string | null` — background-removed avatar (already on `profiles` table)

**`stats` query** — `card_type` already exists on `player_stats` and is already fetched in `get-report-data.ts`. Pass it through to `ReportData.stats`:

- `card_type: CardType | null`

### PlayerCard rendering notes

- `position` is already in `ReportData.profile` as `string | null`. Before passing to `PlayerCard` (which requires `PlayerPosition`), cast with a fallback: `(profile.position as PlayerPosition) ?? "FW"`.
- The FIFA card is rendered in a hidden `div` (`visibility: hidden; position: absolute; pointer-events: none`) on the report page before capture.
- `captureChartAsImage` is called with `backgroundColor: undefined` (transparent) for the FIFA card to preserve the gold gradient background. Create a separate `captureCardAsImage` util or add an optional `backgroundColor` param to the existing one.
- **CORS note:** The card template image (`/card-template-gold.webp`) is served locally — no issue. The player avatar (`processed_avatar_url`) is a Supabase Storage URL. Supabase Storage buckets must have CORS headers permitting the site origin, or pass `{ useCORS: true }` to `html-to-image`. If CORS fails, fall back to rendering the FIFA card without the avatar image.

---

## Implementation Scope

### Files to modify

1. **`src/features/player-report/types/index.ts`**
   - Add `processed_avatar_url: string | null` to `profile`
   - Add `card_type: string | null` to `stats`

2. **`src/features/player-report/lib/actions/get-report-data.ts`**
   - Select `processed_avatar_url` from `profiles`
   - Include `card_type` from the existing `player_stats` select

3. **`src/features/player-report/components/ReportEditor.tsx`**
   - Add `fifaCardRef = useRef<HTMLDivElement>(null)`
   - Render hidden `PlayerCard` div (off-screen) using `data.profile` + `data.stats`
   - Pass `fifaCardRef` to `PlayerReportPdfButton`

4. **`src/features/player-report/components/PlayerReportPdfButton.tsx`**
   - Accept `fifaCardRef: React.RefObject<HTMLDivElement | null>` prop
   - Capture FIFA card image alongside radar/trends on click
   - Pass `fifaCardImage` to the PDF template

5. **`src/features/player-report/lib/utils/chart-snapshot.ts`**
   - Add optional `backgroundColor` parameter (default `"#ffffff"`)
   - Used to capture FIFA card with transparent/no background

6. **`src/lib/exports/pdf-player-report-template.tsx`**
   - Full redesign per mockup: dark page, scout-report header with FIFA card image, two-column body, assessment table with improvement highlighting, 2-page structure

### Files unchanged

- `ReportChartsSection.tsx`
- All other report components

---

## Out of Scope

- Changing the web UI of the report editor
- Adding new assessment metrics
- Changing how the FIFA card is generated or stored
