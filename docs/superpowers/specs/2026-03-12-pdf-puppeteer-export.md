# Player Report PDF — Puppeteer Server-Side Export

**Date:** 2026-03-12
**Status:** Approved
**Feature:** `src/features/player-report`

---

## Overview

Replace the broken `@react-pdf/renderer` client-side PDF generation with a server-side Puppeteer approach. The client sends already-loaded report data to a Next.js API route; the server builds a complete HTML string (porting the approved mockup styles) and uses Puppeteer + `@sparticuz/chromium` to export a 2-page A4 PDF.

---

## Request Flow

```text
User clicks "הורד PDF"
  → PlayerReportPdfButton collects:
      data.profile, data.assessments, data.stats, data.attendance (totalSessions + weeklyAverage only)
      + current edited: summary (string), strengths (string[]), weaknesses (string[]), socialSkills (string[])
        (BulletItem[] is pre-mapped to string[] on the client via .map(s => s.text))
  → POST /api/player-report/pdf  (JSON body, validated with Zod)
  → Server: auth check (manual role check via Supabase server client)
  → Server: fetchAvatarAsBase64(profile.processed_avatar_url) → data URI (with SSRF guard)
  → Server: buildPlayerReportHtml(props) → HTML string
  → Server: Puppeteer renders HTML → PDF binary
  → Response: application/pdf, filename = "סיכום-שחקן-{name}-{date}.pdf"
  → Client: triggers file download
```

No `html-to-image` captures. No `@react-pdf/renderer`. No re-fetch from Supabase. All charts (FIFA card, radar, mini metric charts) are generated server-side as HTML/CSS and inline SVG. `compareMetric` is imported directly from `src/features/player-report/lib/utils/metric-comparison.ts` — not re-implemented.

---

## Files

### New

| File | Purpose |
| ---- | ------- |
| `src/app/api/player-report/pdf/route.ts` | POST handler — Zod validation, auth, avatar fetch, build HTML, run Puppeteer, return PDF |
| `src/lib/exports/player-report-html.ts` | `buildPlayerReportHtml(props)` → full 2-page HTML string |

### Modified

| File | Change |
| ---- | ------ |
| `src/features/player-report/components/PlayerReportPdfButton.tsx` | Remove html-to-image captures and @react-pdf imports; replace with `fetch` to new route; remove `radarRef`, `trendsRef`, `fifaCardRef` from props interface |
| `src/features/player-report/components/ReportEditor.tsx` | Remove `fifaCardRef`, `radarRef`, `trendsRef` refs and hidden `PlayerCard` div; remove `PlayerCard`/`CardType`/`PlayerPosition` imports (now unused); update `PlayerReportPdfButton` call site to match new props interface (atomic change with button) |
| `next.config.ts` | **Merge** `serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core']` into existing `experimental` block — do not replace it |

### New Dependencies

- `puppeteer-core`
- `@sparticuz/chromium`

---

## API Route: `POST /api/player-report/pdf`

**Runtime:** `nodejs` (not edge — add `export const runtime = 'nodejs'`)
**maxDuration:** 60 (requires Vercel Pro — Hobby plan has a 10s limit which is insufficient; cold-start with `@sparticuz/chromium` alone can take 15–20s)

### Request Body (Zod schema required)

```typescript
{
  profile: {
    full_name: string | null;
    birthdate: string | null;       // used to compute age in the header chip
    position: string | null;
    club: string | null;
    created_at: string;             // used for "הצטרפות" chip
    processed_avatar_url: string | null;  // fetched server-side for FIFA card avatar
    // card_type and other unused fields may be included but are ignored
  };
  assessments: PlayerAssessment[];  // all assessments, sorted newest-first
  stats: {
    overall_rating: number;
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
    card_type: string | null;
  } | null;
  attendance: {
    totalSessions: number;
    weeklyAverage: number;
    // sessions array is excluded from the body — only aggregates are needed
  } | null;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  socialSkills: string[];
}
```

> Note: `strengths`, `weaknesses`, `socialSkills` are pre-mapped `string[]` (client calls `.map(s => s.text)` on the `BulletItem[]` before sending). Body size: players typically have fewer than 20 assessments; the expected payload is well under Next.js's default 1MB Route Handler body limit. No `maxBodySize` override is needed.

### Auth

Call `verifyAdminOrTrainer()` from `src/lib/actions/shared/`. It is a plain async function and can be imported and called directly from a Route Handler — the `"use server"` file-level directive only restricts client-component calls. Return 401 if the check fails.

### Avatar Image — SSRF Guard

Before fetching `profile.processed_avatar_url` server-side:

1. If null or empty → skip, use initials fallback in the FIFA card.
2. Validate that the URL starts with `process.env.NEXT_PUBLIC_SUPABASE_URL` (the project's Supabase storage domain). If validation fails → skip, use initials fallback. Do not fetch arbitrary URLs.
3. On successful validation, `fetch(url)` → `arrayBuffer()` → base64 data URI embedded in the HTML `<img>` tag.
4. On fetch error → fall back to initials.

### Puppeteer Setup

```typescript
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const executablePath = process.env.LOCAL_CHROME_PATH ?? await chromium.executablePath();

const browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: { width: 794, height: 1123 },
  executablePath,
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  return pdf;
} finally {
  await browser.close(); // always close, even on error
}
```

### Response

Success:

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename*=UTF-8''%D7%A1%D7%99%D7%9B%D7%95%D7%9D-%D7%A9%D7%97%D7%A7%D7%9F-{encoded_name}-{YYYY-MM-DD}.pdf
```

Use `encodeURIComponent` on the player name before embedding in the `filename*=UTF-8''` parameter. This handles Hebrew characters correctly across all browsers per RFC 6266 / RFC 5987.

Error (any non-200):

```json
{ "error": "human-readable message" }
```

Consistent with the project's `{ error: string }` envelope pattern. The client reads `response.json().error` and shows it as a toast.

### Null Handling

| Data | Fallback behavior |
| ---- | ----------------- |
| `stats` is null | Omit FIFA card entirely; show "—" in stats column; hide radar chart on page 2 |
| `attendance` is null | Show "לא זמין" in attendance chip and stats column |
| `assessments` is empty | Omit assessment table on page 1; omit mini metric charts on page 2 |
| Avatar fetch fails / URL null | Show player initials in FIFA card avatar circle |

---

## HTML Template: `buildPlayerReportHtml`

A pure function returning a complete self-contained HTML string. Takes the same shape as the validated request body plus a pre-fetched `avatarDataUri: string | null`.

### Font

Read `Heebo-Regular.ttf` and `Heebo-Bold.ttf` from `public/fonts/` via `fs.readFileSync(path.join(process.cwd(), 'public/fonts/...'))`. Convert each to base64. Embed as `@font-face` data URIs in the `<style>` block. This makes the HTML self-contained — Puppeteer needs no external font requests.

### Metric Keys

Two lists are used throughout the template:

```typescript
// Numeric metrics — used for assessment table rows and mini line charts on page 2
const NUMERIC_METRIC_KEYS: (keyof PlayerAssessment)[] = [
  "sprint_5m", "sprint_10m", "sprint_20m",
  "jump_2leg_height", "jump_2leg_distance", "jump_right_leg", "jump_left_leg",
  "blaze_spot_time", "kick_power_kaiser",
  "flexibility_ankle", "flexibility_knee", "flexibility_hip",
];

// Categorical metrics — shown in assessment table as text; no mini line chart on page 2
const CATEGORICAL_METRIC_KEYS: (keyof PlayerAssessment)[] = [
  "coordination", "body_structure", "leg_power_technique",
];

// All metrics for the assessment table (numeric first, then categorical)
const ALL_METRIC_KEYS = [...NUMERIC_METRIC_KEYS, ...CATEGORICAL_METRIC_KEYS];
```

`compareMetric` is imported from `src/features/player-report/lib/utils/metric-comparison.ts`. Its actual return type is `"improved" | "declined" | "unchanged" | "categorical" | null`. Use `"unchanged"` (not `"same"`) for no-change logic. Use `"categorical"` to identify categorical metrics in the assessment table (no colour change). The `null` return means one or both values are missing — treat the same as `"unchanged"` visually.

### Page 1

Direct port of the approved mockup (`pdf-mockup-v3.html`):

- **Header:** player name (40px, weight 900, letter-spacing 2px, uppercase), meta chips (green for academy name, dark for position/club/age/join date/attendance), FIFA card (pure HTML/CSS gold gradient — see below). Age is computed from `profile.birthdate` at template-build time.
- **Body:** stats column (44px green overall_rating, 24px white sprint/jump/kick values; `border-left: 1px solid #1f2937` separator — no card background) + content column (summary paragraphs in 11.5px `#d1d5db` + 3-column horizontal bullets row)
- **Assessment table:** `ALL_METRIC_KEYS` rows. Columns: metric Hebrew label | latest value | previous value (if 2+ assessments). Green (`#22c55e`) for improved, amber (`#d97706`) for declined (using `compareMetric`). Categorical rows: no colour change. Display categorical values using their Hebrew label strings — use `COORDINATION_OPTIONS`, `BODY_STRUCTURE_OPTIONS`, and `LEG_POWER_OPTIONS` label arrays from `src/types/assessment.ts` to map raw DB enum values (e.g. `"thin_weak"`) to their Hebrew display strings (e.g. `"רזה חלש"`). Fall back to the raw value if no match found.
- **Footer:** "Garden of Eden Football Academy" | "דף 1 מתוך 2" | date

**FIFA card** (pure HTML/CSS, rendered only if `stats` is non-null):

- Gold gradient background (`linear-gradient(145deg, #c8a84b, #f5d580, #c8a84b, #a07828)`)
- Top row: `overall_rating` (26px), `position`
- Avatar: `<img src="{avatarDataUri}">` if available, else player initials in a circle
- Player abbreviated name
- 6 stat badges: PAC (`pace`), SHO (`shooting`), PAS (`passing`), DRI (`dribbling`), DEF (`defending`), PHY (`physical`)

### Page 2

**Top section — radar + highlights side by side:**

- **Radar SVG (left, ~200px wide):** Hexagonal, 6 axes — pace (top), shooting (top-right), physical (bottom-right), defending (bottom), dribbling (bottom-left), passing (top-left). Values 0–100 mapped to distance from center via polar-to-Cartesian. Background grid rings at 25/50/75/100%. Filled polygon in `rgba(34,197,94,0.2)` with `#22c55e` stroke. Hebrew axis labels. Rendered only if `stats` is non-null.
- **Highlights box (right, flex:1):** Shows `overall_rating` as a large number, number of assessments, and the top 2 most improved metrics (determined by `compareMetric` on `assessments[0]` vs `assessments[1]`). This replaces the "overall rating trend over time" chart from the mockup — we do not have historical per-assessment overall ratings in the data model, so a trend line cannot be drawn accurately.

**Bottom section — mini metric charts (3-column grid):**

One card per metric in `NUMERIC_METRIC_KEYS` that has at least 2 non-null values across assessments. Each card:

- Metric Hebrew label (from `ASSESSMENT_LABELS_HE`)
- Change label: "↑/↓ Δvalue (שיפור/ירידה)" or "→ ללא שינוי"
- 60px-tall polyline SVG: assessments plotted oldest→newest on X axis, raw metric value on Y axis (scaled to fit the 60px height using local min/max from the data). Dots at each point, last dot slightly larger.
- Colour: green if `compareMetric` returns `"improved"`, amber if `"declined"`, grey if unchanged or insufficient data.

Categorical metrics (`CATEGORICAL_METRIC_KEYS`) do not appear in the mini chart grid. They appear only in the page 1 assessment table.

If `assessments.length < 2`, the entire mini chart grid is omitted and a "אין מספיק מבדקים להצגת מגמות" message is shown instead.

**Footer:** same as page 1 with "דף 2 מתוך 2".

---

## Environment Variables

Add to `.env.local.example`:

```bash
LOCAL_CHROME_PATH=      # Path to local Chrome binary for dev (e.g. /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome)
```

Not required in production (Vercel uses `@sparticuz/chromium`'s bundled binary).

---

## `next.config.ts` Change

**Merge** into the existing `experimental` block (do not replace):

```typescript
experimental: {
  // ...existing keys...
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
}
```

---

## Out of Scope

- Changing the web UI of the report editor
- Saving PDFs to Supabase Storage
- Any other export formats
- Adding `overall_rating` history to the data model (would enable a proper trend chart in a future iteration)
