# Player Report PDF — Puppeteer Server-Side Export

**Date:** 2026-03-12
**Status:** Approved
**Feature:** `src/features/player-report`

---

## Overview

Replace the broken `@react-pdf/renderer` client-side PDF generation with a server-side Puppeteer approach. The client sends already-loaded report data to a Next.js API route; the server builds a complete HTML string (porting the approved mockup styles) and uses Puppeteer + `@sparticuz/chromium` to export a 2-page A4 PDF.

---

## Request Flow

```
User clicks "הורד PDF"
  → PlayerReportPdfButton collects:
      data (ReportData already loaded on page)
      + current edited: summary, strengths, weaknesses, socialSkills
  → POST /api/player-report/pdf  (JSON body)
  → Server: auth check (verifyAdminOrTrainer)
  → Server: buildPlayerReportHtml(props) → HTML string
  → Server: Puppeteer renders HTML → PDF binary
  → Response: application/pdf
  → Client: triggers file download
```

No `html-to-image` captures. No `@react-pdf/renderer`. No re-fetch from Supabase. All charts (FIFA card, radar, trend line, mini metric charts) are generated server-side as HTML/CSS and inline SVG.

---

## Files

### New

| File | Purpose |
|------|---------|
| `src/app/api/player-report/pdf/route.ts` | POST handler — auth, build HTML, run Puppeteer, return PDF |
| `src/lib/exports/player-report-html.ts` | `buildPlayerReportHtml(props)` → full 2-page HTML string |

### Modified

| File | Change |
|------|--------|
| `src/features/player-report/components/PlayerReportPdfButton.tsx` | Remove html-to-image captures and @react-pdf imports; replace with `fetch` to new route |
| `src/features/player-report/components/ReportEditor.tsx` | Remove `fifaCardRef`, `radarRef`, `trendsRef` refs and hidden `PlayerCard` div |
| `next.config.ts` | Add `serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core']` |

### New Dependencies

- `puppeteer-core`
- `@sparticuz/chromium`

---

## API Route: `POST /api/player-report/pdf`

**Runtime:** `nodejs` (not edge)
**maxDuration:** 30s

### Request Body

```typescript
{
  profile: ReportData['profile'];
  assessments: readonly PlayerAssessment[];
  stats: ReportData['stats'];
  attendance: ReportData['attendance'];
  summary: string;
  strengths: string[];
  weaknesses: string[];
  socialSkills: string[];
}
```

### Auth

Calls `verifyAdminOrTrainer()` from `src/lib/actions/shared/` via the Supabase server client. Returns 401 if check fails.

### Puppeteer Setup

Uses `@sparticuz/chromium` + `puppeteer-core` for Vercel compatibility:

```typescript
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: { width: 794, height: 1123 },
  executablePath: await chromium.executablePath(),
  headless: true,
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
const pdf = await page.pdf({ format: 'A4', printBackground: true });
await browser.close();
```

For local development, `chromium.executablePath()` is overridden with the local Chrome path via an env var (`LOCAL_CHROME_PATH`).

### Response

Returns `application/pdf` with `Content-Disposition: attachment; filename="report.pdf"`.

---

## HTML Template: `buildPlayerReportHtml`

A pure function taking the request body shape and returning a complete HTML string.

### Font

`Heebo-Regular.ttf` and `Heebo-Bold.ttf` are read from `public/fonts/` via `fs.readFileSync` and embedded as base64 `@font-face` data URIs in the `<style>` block. This makes the HTML self-contained with no external font requests.

### Avatar Image

`profile.processed_avatar_url` is fetched server-side (`fetch(url)`) and converted to a base64 data URI before embedding in the FIFA card `<img>` tag. Falls back to showing the player's initials if the fetch fails or URL is null.

### Page 1

Direct port of the approved mockup (`pdf-mockup-v3.html`):

- **Header:** player name (40px, weight 900, letter-spacing 2px), meta chips (green for academy, dark for position/club/age/join date/attendance), FIFA card (pure HTML/CSS gold gradient, avatar image)
- **Body:** stats column (44px rating in green, 24px sprint/jump/kick values) with a `border-left` separator (no card background) + content column (summary paragraphs + 3-column bullets row)
- **Assessment table:** full-width, columns: metric name | latest | previous. Improvement highlighted green, decline amber. Uses `compareMetric` logic ported to a plain TS function inside the template builder (lower-is-better for sprints, higher-is-better for jumps/kick/flexibility, no highlight for categoricals)
- **Footer:** academy name, page number, date

### Page 2

- **Radar SVG:** hexagonal, 6 axes (pace, shooting, passing, dribbling, defending, physical). Points computed via polar-to-Cartesian math from `stats` values (0–100 scale). Includes background grid rings at 25/50/75/100% and axis labels in Hebrew.
- **Rating trend:** if 2+ assessments exist, compute a normalized physical performance score per assessment (mean of normalized numeric metric values, lower-is-better metrics inverted). Plot as a polyline with dots and date labels. If only 1 assessment, show the overall rating prominently as a large number.
- **Mini metric charts (3-column grid):** one card per numeric metric in `METRIC_KEYS`. Each card shows metric name, change label (↑/↓/→), and a 60px-tall polyline SVG across all assessments oldest→newest. Color: green if improved, amber if declined, grey if unchanged or categorical.
- **Footer:** same as page 1

---

## `next.config.ts` Change

```typescript
experimental: {
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
}
```

---

## Out of Scope

- Changing the web UI of the report editor (visual appearance, edit flow)
- Saving PDFs to Supabase Storage
- Any other export formats
