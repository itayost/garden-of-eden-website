# Player Report PDF — Puppeteer Export Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace broken `@react-pdf/renderer` client-side PDF with a server-side Puppeteer approach that renders a self-contained HTML string to an A4 PDF.

**Architecture:** Client POSTs already-loaded `ReportData` + edited text to `POST /api/player-report/pdf`. Server validates with Zod, fetches avatar as base64 (SSRF-guarded), builds a 2-page HTML string (Heebo fonts + card image embedded as base64 data URIs), renders it with `puppeteer-core`/`@sparticuz/chromium`, and returns a PDF binary. No `html-to-image` captures — all charts (FIFA card, radar, mini metric charts) are generated as inline HTML/CSS and SVG on the server.

**Tech Stack:** `puppeteer-core`, `@sparticuz/chromium`, Zod, Next.js Route Handler (Node.js runtime), Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/exports/player-report-html.ts` | Pure functions: `loadStaticAssets`, `buildRadarSvg`, `buildMiniChartSvg`, `buildPlayerReportHtml` |
| Create | `src/lib/exports/__tests__/player-report-html.test.ts` | Unit tests for `buildPlayerReportHtml` (pure function) |
| Create | `src/app/api/player-report/pdf/schema.ts` | Zod schema `playerReportPdfBodySchema` (exported for testing) |
| Create | `src/app/api/player-report/pdf/route.ts` | POST handler: auth, avatar fetch, HTML build, Puppeteer, PDF response |
| Create | `src/app/api/player-report/__tests__/pdf-schema.test.ts` | Unit tests for Zod schema |
| Modify | `src/features/player-report/components/ReportChartsSection.tsx` | Remove `radarRef` and `trendsRef` props |
| Modify | `src/features/player-report/components/PlayerReportPdfButton.tsx` | Replace html-to-image + @react-pdf with `fetch` to new route |
| Modify | `src/features/player-report/components/ReportEditor.tsx` | Remove refs, hidden `PlayerCard` div, `PlayerCard`/`CardType`/`PlayerPosition` imports |
| Modify | `next.config.ts` | Merge `serverExternalPackages` into existing `experimental` block |
| Modify | `.env.local.example` | Add `LOCAL_CHROME_PATH` |

---

## Chunk 1: Setup & Configuration

### Task 1: Install new dependencies

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install puppeteer-core and @sparticuz/chromium**

```bash
npm install puppeteer-core @sparticuz/chromium
```

Expected: Both packages added to `dependencies` in `package.json`. No peer-dependency errors.

- [ ] **Step 2: Verify install**

```bash
node -e "require('puppeteer-core'); console.log('ok')"
```

Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(pdf): install puppeteer-core and @sparticuz/chromium"
```

---

### Task 2: Update next.config.ts

**Files:**
- Modify: `next.config.ts:4-15`

The existing `experimental` block has only `optimizePackageImports`. Merge `serverExternalPackages` into it — do not replace the block.

- [ ] **Step 1: Edit next.config.ts**

Change the `experimental` block from:
```typescript
experimental: {
  optimizePackageImports: [
    "lucide-react",
    "recharts",
    "framer-motion",
    "@radix-ui/react-alert-dialog",
    "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-select",
    "@radix-ui/react-tabs",
    "@radix-ui/react-tooltip",
  ],
},
```

To:
```typescript
experimental: {
  optimizePackageImports: [
    "lucide-react",
    "recharts",
    "framer-motion",
    "@radix-ui/react-alert-dialog",
    "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-select",
    "@radix-ui/react-tabs",
    "@radix-ui/react-tooltip",
  ],
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
},
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "chore(pdf): add serverExternalPackages for puppeteer-core and chromium"
```

---

### Task 3: Add env var to .env.local.example

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Append LOCAL_CHROME_PATH to .env.local.example**

Add at the end of the file:
```bash
LOCAL_CHROME_PATH=      # Path to local Chrome binary for dev (e.g. /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome)
```

- [ ] **Step 2: Commit**

```bash
git add .env.local.example
git commit -m "chore(pdf): document LOCAL_CHROME_PATH env var"
```

---

## Chunk 2: HTML Template Builder

### Task 4: Write failing tests for buildPlayerReportHtml

**Files:**
- Create: `src/lib/exports/__tests__/player-report-html.test.ts`

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect } from "vitest";
import { buildPlayerReportHtml } from "../player-report-html";
import type { StaticAssets, PlayerReportHtmlProps } from "../player-report-html";
import type { PlayerAssessment } from "@/types/assessment";

const mockAssets: StaticAssets = {
  heeboRegularB64: "AAAA",
  heeboBoldB64: "BBBB",
  cardTemplateB64: "CCCC",
};

function makeAssessment(overrides: Partial<PlayerAssessment> = {}): PlayerAssessment {
  return {
    id: "1",
    user_id: "u1",
    assessment_date: "2026-01-01",
    sprint_5m: 1.2,
    sprint_10m: 2.0,
    sprint_20m: 3.5,
    jump_2leg_height: 40,
    jump_2leg_distance: 180,
    jump_right_leg: 90,
    jump_left_leg: 88,
    blaze_spot_time: 30,
    kick_power_kaiser: 250,
    flexibility_ankle: 15,
    flexibility_knee: 12,
    flexibility_hip: 20,
    coordination: "advanced",
    leg_power_technique: "normal",
    body_structure: "good_build",
    concentration_notes: null,
    decision_making_notes: null,
    work_ethic_notes: null,
    recovery_notes: null,
    nutrition_notes: null,
    assessed_by: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const mockProfile: PlayerReportHtmlProps["profile"] = {
  full_name: "ישראל ישראלי",
  birthdate: "2010-01-01",
  position: "ST",
  club: "מועדון העדן",
  created_at: "2024-01-01T00:00:00Z",
  processed_avatar_url: null,
};

const mockStats: NonNullable<PlayerReportHtmlProps["stats"]> = {
  overall_rating: 75,
  pace: 80,
  shooting: 70,
  passing: 72,
  dribbling: 78,
  defending: 65,
  physical: 77,
  card_type: "gold",
};

function makeProps(overrides: Partial<PlayerReportHtmlProps> = {}): PlayerReportHtmlProps {
  return {
    profile: mockProfile,
    assessments: [],
    stats: null,
    attendance: null,
    summary: "",
    strengths: [],
    weaknesses: [],
    socialSkills: [],
    avatarDataUri: null,
    ...overrides,
  };
}

describe("buildPlayerReportHtml", () => {
  it("returns a string starting with DOCTYPE", () => {
    const html = buildPlayerReportHtml(makeProps(), mockAssets);
    expect(html).toMatch(/^<!DOCTYPE html>/);
  });

  it("includes the player name", () => {
    const html = buildPlayerReportHtml(makeProps(), mockAssets);
    expect(html).toContain("ישראל ישראלי");
  });

  it("includes FIFA card with card template image when stats provided", () => {
    const html = buildPlayerReportHtml(makeProps({ stats: mockStats }), mockAssets);
    expect(html).toContain("data:image/webp;base64,CCCC");
    expect(html).toContain("75"); // overall_rating
  });

  it("omits card template and shows fallback when stats are null", () => {
    const html = buildPlayerReportHtml(makeProps({ stats: null }), mockAssets);
    expect(html).not.toContain("data:image/webp;base64,CCCC");
    expect(html).toContain("אין נתוני FIFA");
  });

  it("shows לא זמין for attendance when null", () => {
    const html = buildPlayerReportHtml(makeProps({ attendance: null }), mockAssets);
    expect(html).toContain("לא זמין");
  });

  it("shows attendance stats when provided", () => {
    const html = buildPlayerReportHtml(
      makeProps({ attendance: { totalSessions: 42, weeklyAverage: 2.5 } }),
      mockAssets,
    );
    expect(html).toContain("42");
  });

  it("includes assessment table metric labels when assessments present", () => {
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [makeAssessment()] }),
      mockAssets,
    );
    expect(html).toContain("ספרינט 5 מטר");
  });

  it("omits assessment table when assessments empty", () => {
    const html = buildPlayerReportHtml(makeProps({ assessments: [] }), mockAssets);
    expect(html).not.toContain("ספרינט 5 מטר");
  });

  it("maps coordination enum to Hebrew label", () => {
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [makeAssessment({ coordination: "advanced" })] }),
      mockAssets,
    );
    expect(html).toContain("מתקדמת");
  });

  it("shows mini chart SVG when 2+ assessments", () => {
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [makeAssessment(), makeAssessment()] }),
      mockAssets,
    );
    expect(html).toContain("<polyline");
  });

  it("shows אין מספיק מבדקים when fewer than 2 assessments", () => {
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [makeAssessment()] }),
      mockAssets,
    );
    expect(html).toContain("אין מספיק מבדקים");
  });

  it("uses green (#22c55e) for improved metrics (lower sprint time)", () => {
    // sprint lower is better; a1=latest=1.0 < a2=prev=1.5 → improved
    const a1 = makeAssessment({ sprint_5m: 1.0 });
    const a2 = makeAssessment({ sprint_5m: 1.5 });
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [a1, a2] }),
      mockAssets,
    );
    expect(html).toContain("#22c55e");
  });

  it("uses amber (#d97706) for declined metrics (higher sprint time)", () => {
    // sprint lower is better; a1=latest=1.5 > a2=prev=1.2 → declined
    const a1 = makeAssessment({ sprint_5m: 1.5 });
    const a2 = makeAssessment({ sprint_5m: 1.2 });
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [a1, a2] }),
      mockAssets,
    );
    expect(html).toContain("#d97706");
  });

  it("includes radar SVG polygon when stats provided", () => {
    const html = buildPlayerReportHtml(makeProps({ stats: mockStats }), mockAssets);
    expect(html).toContain("rgba(34,197,94,0.2)");
  });

  it("omits radar SVG when stats are null", () => {
    const html = buildPlayerReportHtml(makeProps({ stats: null }), mockAssets);
    expect(html).not.toContain("rgba(34,197,94,0.2)");
  });

  it("embeds avatar data URI in FIFA card when provided", () => {
    const html = buildPlayerReportHtml(
      makeProps({ stats: mockStats, avatarDataUri: "data:image/png;base64,AVATAR" }),
      mockAssets,
    );
    expect(html).toContain("data:image/png;base64,AVATAR");
  });

  it("shows player initials in FIFA card when no avatar", () => {
    const html = buildPlayerReportHtml(
      makeProps({ stats: mockStats, avatarDataUri: null }),
      mockAssets,
    );
    // First char of full_name
    expect(html).toContain("ישראל ישראלי".charAt(0));
  });

  it("includes summary text", () => {
    const html = buildPlayerReportHtml(makeProps({ summary: "שחקן מצוין" }), mockAssets);
    expect(html).toContain("שחקן מצוין");
  });

  it("includes strength and weakness bullets", () => {
    const html = buildPlayerReportHtml(
      makeProps({ strengths: ["מהיר"], weaknesses: ["חלש בהגנה"] }),
      mockAssets,
    );
    expect(html).toContain("מהיר");
    expect(html).toContain("חלש בהגנה");
  });

  it("shows both page footers", () => {
    const html = buildPlayerReportHtml(makeProps(), mockAssets);
    expect(html).toContain("דף 1 מתוך 2");
    expect(html).toContain("דף 2 מתוך 2");
  });

  it("shows אין שיפורים מדידים when no metrics improved across 2 assessments", () => {
    // Both assessments identical → no improvement
    const a = makeAssessment({ sprint_5m: 1.2, jump_2leg_height: 40 });
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [a, a] }),
      mockAssets,
    );
    expect(html).toContain("אין שיפורים מדידים");
  });

  it("embeds Heebo font data URIs", () => {
    const html = buildPlayerReportHtml(makeProps(), mockAssets);
    expect(html).toContain("base64,AAAA"); // heeboRegularB64
    expect(html).toContain("base64,BBBB"); // heeboBoldB64
  });
});
```

- [ ] **Step 2: Run tests — verify they fail (module not found)**

```bash
npx vitest run src/lib/exports/__tests__/player-report-html.test.ts
```

Expected: FAIL — `Cannot find module '../player-report-html'`

---

### Task 5: Implement src/lib/exports/player-report-html.ts

**Files:**
- Create: `src/lib/exports/player-report-html.ts`

- [ ] **Step 1: Create the file**

```typescript
import fs from "fs";
import path from "path";
import type { PlayerAssessment } from "@/types/assessment";
import {
  ASSESSMENT_LABELS_HE,
  COORDINATION_OPTIONS,
  BODY_STRUCTURE_OPTIONS,
  LEG_POWER_OPTIONS,
} from "@/types/assessment";
import { compareMetric } from "@/features/player-report/lib/utils/metric-comparison";

export interface StaticAssets {
  heeboRegularB64: string;
  heeboBoldB64: string;
  cardTemplateB64: string;
}

export interface PlayerReportHtmlProps {
  profile: {
    full_name: string | null;
    birthdate: string | null;
    position: string | null;
    club: string | null;
    created_at: string;
    processed_avatar_url: string | null;
  };
  assessments: PlayerAssessment[];
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
  attendance: { totalSessions: number; weeklyAverage: number } | null;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  socialSkills: string[];
  avatarDataUri: string | null;
}

// Spec-defined metric key lists
const NUMERIC_METRIC_KEYS: (keyof PlayerAssessment)[] = [
  "sprint_5m", "sprint_10m", "sprint_20m",
  "jump_2leg_height", "jump_2leg_distance", "jump_right_leg", "jump_left_leg",
  "blaze_spot_time", "kick_power_kaiser",
  "flexibility_ankle", "flexibility_knee", "flexibility_hip",
];

const CATEGORICAL_METRIC_KEYS: (keyof PlayerAssessment)[] = [
  "coordination", "body_structure", "leg_power_technique",
];

const ALL_METRIC_KEYS: (keyof PlayerAssessment)[] = [
  ...NUMERIC_METRIC_KEYS,
  ...CATEGORICAL_METRIC_KEYS,
];

export function loadStaticAssets(): StaticAssets {
  const pub = (rel: string) => path.join(process.cwd(), "public", rel);
  return {
    heeboRegularB64: fs.readFileSync(pub("fonts/Heebo-Regular.ttf")).toString("base64"),
    heeboBoldB64: fs.readFileSync(pub("fonts/Heebo-Bold.ttf")).toString("base64"),
    cardTemplateB64: fs.readFileSync(pub("card-template-gold.webp")).toString("base64"),
  };
}

// SVG helpers

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function buildRadarSvg(stats: NonNullable<PlayerReportHtmlProps["stats"]>): string {
  const cx = 100, cy = 110, maxR = 75;
  const axes = [
    { key: "pace" as const,      label: "קצב",    angle: 90 },
    { key: "shooting" as const,  label: "קליעה",  angle: 30 },
    { key: "physical" as const,  label: "פיזי",   angle: -30 },
    { key: "defending" as const, label: "הגנה",   angle: -90 },
    { key: "dribbling" as const, label: "כדרור",  angle: -150 },
    { key: "passing" as const,   label: "מסירה",  angle: 150 },
  ];

  const rings = [25, 50, 75, 100].map((pct) => {
    const r = (maxR * pct) / 100;
    const pts = axes.map(({ angle }) => {
      const { x, y } = polarToCartesian(cx, cy, r, angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>`;
  }).join("");

  const axisLines = axes.map(({ angle }) => {
    const { x, y } = polarToCartesian(cx, cy, maxR, angle);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>`;
  }).join("");

  const dataPts = axes.map(({ key, angle }) => {
    const val = Math.max(0, Math.min(100, stats[key]));
    const r = (maxR * val) / 100;
    const { x, y } = polarToCartesian(cx, cy, r, angle);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const labels = axes.map(({ label, angle }) => {
    const { x, y } = polarToCartesian(cx, cy, maxR + 14, angle);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="#9ca3af">${label}</text>`;
  }).join("");

  return `<svg width="200" height="220" xmlns="http://www.w3.org/2000/svg">
${rings}${axisLines}
<polygon points="${dataPts}" fill="rgba(34,197,94,0.2)" stroke="#22c55e" stroke-width="1.5"/>
${labels}
</svg>`;
}

function buildMiniChartSvg(
  key: keyof PlayerAssessment,
  assessments: PlayerAssessment[],
  color: string,
): string {
  // Reverse: assessments are newest-first; chart needs oldest-first
  const values = [...assessments]
    .reverse()
    .map((a) => a[key])
    .filter((v) => v !== null && v !== undefined)
    .map(Number);

  if (values.length < 2) return "";

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const W = 120, H = 60, pad = 6;
  const cW = W - 2 * pad, cH = H - 2 * pad;

  const pts = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * cW,
    y: pad + (1 - (v - minVal) / range) * cH,
  }));

  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const dots = pts.map((p, i) => {
    const r = i === pts.length - 1 ? 3 : 2;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${color}"/>`;
  }).join("");

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
}

// Helpers

function computeAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  return Math.floor((Date.now() - new Date(birthdate).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function formatISODate(isoStr: string): string {
  return isoStr.split("T")[0];
}

function getCategoricalLabel(key: keyof PlayerAssessment, value: string): string {
  if (key === "coordination") return COORDINATION_OPTIONS.find((o) => o.value === value)?.label ?? value;
  if (key === "body_structure") return BODY_STRUCTURE_OPTIONS.find((o) => o.value === value)?.label ?? value;
  if (key === "leg_power_technique") return LEG_POWER_OPTIONS.find((o) => o.value === value)?.label ?? value;
  return value;
}

function chip(text: string, green = false): string {
  const bg = green ? "#166534" : "#1f2937";
  const fg = green ? "#86efac" : "#d1d5db";
  return `<span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:9999px;font-size:10px;font-weight:600;background:${bg};color:${fg};margin:2px;">${text}</span>`;
}

// Main export

export function buildPlayerReportHtml(
  props: PlayerReportHtmlProps,
  assets: StaticAssets,
): string {
  const { profile, assessments, stats, attendance, summary, strengths, weaknesses, socialSkills, avatarDataUri } = props;
  const { heeboRegularB64, heeboBoldB64, cardTemplateB64 } = assets;

  const today = new Date().toISOString().split("T")[0];
  const age = computeAge(profile.birthdate);
  const joinDate = formatISODate(profile.created_at);

  const latest = assessments[0] ?? null;
  const previous = assessments[1] ?? null;

  // ──────────────────────────────────────
  // FIFA card (140×196, mirrors PlayerCard size="sm")
  // ──────────────────────────────────────
  const W = 140, H = 196;
  const fifaCardHtml = stats
    ? `<div style="position:relative;width:${W}px;height:${H}px;flex-shrink:0;">
<img src="data:image/webp;base64,${cardTemplateB64}" style="position:absolute;top:0;left:0;width:${W}px;height:${H}px;object-fit:contain;" alt=""/>
<div style="position:absolute;top:${Math.round(H * 0.1)}px;left:${Math.round(W * 0.12)}px;display:flex;flex-direction:column;align-items:center;">
<span style="font-size:32px;font-weight:900;color:#3d2a0f;line-height:1;letter-spacing:-0.02em;">${stats.overall_rating}</span>
<span style="font-size:12px;font-weight:700;color:#3d2a0f;margin-top:2px;">${profile.position ?? ""}</span>
</div>
<div style="position:absolute;top:${Math.round(H * 0.22)}px;left:${Math.round(W * 0.2)}px;right:${Math.round(W * 0.2)}px;height:${Math.round(H * 0.42)}px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
${avatarDataUri
  ? `<img src="${avatarDataUri}" style="width:100%;height:100%;object-fit:contain;" alt=""/>`
  : `<div style="width:65px;height:65px;border-radius:50%;background:rgba(61,42,15,0.12);border:2px solid rgba(61,42,15,0.25);display:flex;align-items:center;justify-content:center;"><span style="font-size:29px;font-weight:700;color:#3d2a0f;">${(profile.full_name ?? "?").charAt(0)}</span></div>`
}
</div>
<div style="position:absolute;bottom:${Math.round(H * 0.28)}px;left:${Math.round(W * 0.08)}px;right:${Math.round(W * 0.08)}px;text-align:center;font-size:11px;font-weight:700;color:#3d2a0f;letter-spacing:0.05em;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${profile.full_name ?? ""}</div>
<div style="position:absolute;bottom:${Math.round(H * 0.17)}px;left:${Math.round(W * 0.06)}px;right:${Math.round(W * 0.06)}px;display:flex;justify-content:space-around;align-items:center;" dir="ltr">
${(["PAC","SHO","PAS","DRI","DEF","PHY"] as const).map((label, i) => {
  const vals = [stats.pace, stats.shooting, stats.passing, stats.dribbling, stats.defending, stats.physical];
  return `<div style="display:flex;flex-direction:column;align-items:center;"><span style="font-size:7px;font-weight:600;color:#5c4317;line-height:1.2;">${label}</span><span style="font-size:9px;font-weight:900;color:#3d2a0f;line-height:1.2;">${vals[i]}</span></div>`;
}).join("")}
</div>
</div>`
    : "";

  // ──────────────────────────────────────
  // Assessment table rows
  // ──────────────────────────────────────
  const tableRows = assessments.length === 0
    ? ""
    : ALL_METRIC_KEYS.map((key) => {
        const latestVal = latest ? latest[key] : null;
        const prevVal = previous ? previous[key] : null;
        const isCategorical = (CATEGORICAL_METRIC_KEYS as (keyof PlayerAssessment)[]).includes(key);

        const comparison = !isCategorical && latestVal !== null && prevVal !== null
          ? compareMetric(String(key), latestVal, prevVal)
          : null;

        const color = comparison === "improved" ? "#22c55e"
          : comparison === "declined" ? "#d97706"
          : "inherit";

        const displayLatest = isCategorical && latestVal
          ? getCategoricalLabel(key, String(latestVal))
          : latestVal !== null && latestVal !== undefined ? String(latestVal) : "—";

        const displayPrev = isCategorical && prevVal
          ? getCategoricalLabel(key, String(prevVal))
          : prevVal !== null && prevVal !== undefined ? String(prevVal) : "—";

        return `<tr style="border-bottom:1px solid #1f2937;">
<td style="padding:4px 8px;color:#9ca3af;font-size:10px;">${ASSESSMENT_LABELS_HE[String(key)] ?? String(key)}</td>
<td style="padding:4px 8px;text-align:center;font-size:10px;color:${isCategorical ? "inherit" : color};font-weight:${comparison ? "700" : "400"};">${displayLatest}</td>
${previous ? `<td style="padding:4px 8px;text-align:center;font-size:10px;color:#6b7280;">${displayPrev}</td>` : ""}
</tr>`;
      }).join("");

  // ──────────────────────────────────────
  // Page 2: Highlights
  // ──────────────────────────────────────
  let improvementsHtml = "";
  if (assessments.length >= 2) {
    const improved = NUMERIC_METRIC_KEYS.filter((key) => {
      return compareMetric(String(key), latest?.[key] ?? null, previous?.[key] ?? null) === "improved";
    }).slice(0, 2);

    if (improved.length > 0) {
      improvementsHtml = improved.map((key) => {
        const lv = Number(latest?.[key]);
        const pv = Number(previous?.[key]);
        const delta = Math.abs(lv - pv).toFixed(2);
        return `<div style="margin-bottom:6px;"><span style="color:#22c55e;font-size:11px;">↑ ${ASSESSMENT_LABELS_HE[String(key)] ?? String(key)}</span><span style="color:#6b7280;font-size:10px;margin-right:4px;">Δ${delta}</span></div>`;
      }).join("");
    } else {
      improvementsHtml = `<div style="color:#6b7280;font-size:11px;">אין שיפורים מדידים</div>`;
    }
  }

  // ──────────────────────────────────────
  // Page 2: Mini metric charts
  // ──────────────────────────────────────
  const miniChartsHtml = NUMERIC_METRIC_KEYS.map((key) => {
    const reversedAssessments = [...assessments].reverse();
    const nonNull = reversedAssessments.filter((a) => a[key] !== null && a[key] !== undefined);
    if (nonNull.length < 2) return "";

    const comparison = compareMetric(String(key), assessments[0]?.[key] ?? null, assessments[1]?.[key] ?? null);
    const color = comparison === "improved" ? "#22c55e"
      : comparison === "declined" ? "#d97706"
      : "#6b7280";

    const lv = Number(assessments[0]?.[key]);
    const pv = Number(assessments[1]?.[key]);
    const delta = Math.abs(lv - pv).toFixed(2);
    const changeLabel = comparison === "improved" ? `↑ Δ${delta} (שיפור)`
      : comparison === "declined" ? `↓ Δ${delta} (ירידה)`
      : "→ ללא שינוי";

    const svg = buildMiniChartSvg(key, assessments, color);
    if (!svg) return "";

    return `<div style="background:#1f2937;border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:4px;">
<div style="font-size:9px;color:#9ca3af;">${ASSESSMENT_LABELS_HE[String(key)] ?? String(key)}</div>
<div style="font-size:9px;color:${color};">${changeLabel}</div>
${svg}
</div>`;
  }).filter(Boolean).join("");

  // ──────────────────────────────────────
  // Radar SVG
  // ──────────────────────────────────────
  const radarSvg = stats ? buildRadarSvg(stats) : "";

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"/>
<style>
@font-face{font-family:"Heebo";src:url("data:font/truetype;base64,${heeboRegularB64}") format("truetype");font-weight:400;}
@font-face{font-family:"Heebo";src:url("data:font/truetype;base64,${heeboBoldB64}") format("truetype");font-weight:700 900;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:"Heebo",system-ui,sans-serif;background:#0f172a;color:#f9fafb;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.page{width:794px;min-height:1123px;padding:28px 32px;background:#111827;display:flex;flex-direction:column;position:relative;}
.page-2{page-break-before:always;}
.footer{margin-top:auto;padding-top:12px;border-top:1px solid #1f2937;display:flex;justify-content:space-between;font-size:9px;color:#6b7280;}
table{width:100%;border-collapse:collapse;margin-top:12px;}
th{font-size:10px;color:#6b7280;padding:4px 8px;text-align:right;border-bottom:1px solid #374151;background:#1f2937;}
</style>
</head>
<body>
<!-- PAGE 1 -->
<div class="page">
<div style="border-top:3px solid #22c55e;padding-top:16px;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
<div>
<div style="font-size:40px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#f9fafb;">${profile.full_name ?? "שחקן"}</div>
<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">
${chip("Garden of Eden Football Academy", true)}
${profile.position ? chip(profile.position) : ""}
${profile.club ? chip(profile.club) : ""}
${age !== null ? chip(`גיל ${age}`) : ""}
${chip(`הצטרפות ${joinDate}`)}
${attendance ? chip(`נוכחות ${attendance.weeklyAverage.toFixed(1)}/שבוע`) : chip("נוכחות לא זמין")}
</div>
</div>
${fifaCardHtml}
</div>

<div style="display:flex;gap:24px;flex:1;">
<!-- Stats column -->
<div style="width:140px;border-left:1px solid #1f2937;padding-left:16px;flex-shrink:0;">
${stats ? `<div style="margin-bottom:12px;"><div style="font-size:9px;color:#6b7280;">דירוג כולל</div><div style="font-size:44px;font-weight:900;color:#22c55e;line-height:1;">${stats.overall_rating}</div></div>
${[{label:"ספרינט 5מ",key:"sprint_5m"as const},{label:"ספרינט 10מ",key:"sprint_10m"as const},{label:"ניתור לגובה",key:"jump_2leg_height"as const},{label:"קייזר",key:"kick_power_kaiser"as const}].map(({label,key})=>{const v=latest?.[key];return `<div style="margin-bottom:8px;"><div style="font-size:9px;color:#6b7280;">${label}</div><div style="font-size:24px;font-weight:700;color:#f9fafb;">${v!==null&&v!==undefined?v:"—"}</div></div>`;}).join("")}`
: `<div style="color:#6b7280;font-size:11px;">אין נתוני FIFA</div>`}
${attendance ? `<div style="margin-top:8px;"><div style="font-size:9px;color:#6b7280;">סה"כ אימונים</div><div style="font-size:24px;font-weight:700;color:#f9fafb;">${attendance.totalSessions}</div></div>` : `<div style="color:#6b7280;font-size:10px;margin-top:8px;">נוכחות: לא זמין</div>`}
</div>

<!-- Content column -->
<div style="flex:1;">
${summary ? `<div style="margin-bottom:12px;"><div style="font-size:14px;font-weight:700;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #1f2937;">סיכום</div><div style="font-size:11.5px;color:#d1d5db;line-height:1.6;white-space:pre-wrap;">${summary}</div></div>` : ""}
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:8px;">
<div><div style="font-size:10px;font-weight:700;color:#22c55e;margin-bottom:4px;">נקודות חוזקה</div>${strengths.length?strengths.map(s=>`<div style="font-size:10px;color:#d1d5db;margin-bottom:2px;">• ${s}</div>`).join(""):`<div style="font-size:10px;color:#4b5563;">—</div>`}</div>
<div><div style="font-size:10px;font-weight:700;color:#d97706;margin-bottom:4px;">מיקוד לשיפור</div>${weaknesses.length?weaknesses.map(w=>`<div style="font-size:10px;color:#d1d5db;margin-bottom:2px;">• ${w}</div>`).join(""):``}</div>
<div><div style="font-size:10px;font-weight:700;color:#818cf8;margin-bottom:4px;">כישורים חברתיים</div>${socialSkills.length?socialSkills.map(s=>`<div style="font-size:10px;color:#d1d5db;margin-bottom:2px;">• ${s}</div>`).join(""):``}</div>
</div>
</div>
</div>

${assessments.length > 0 ? `<div style="margin-top:16px;"><div style="font-size:14px;font-weight:700;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #1f2937;">מבדקים</div><table><thead><tr><th>מדד</th><th style="text-align:center;">עדכני</th>${previous?`<th style="text-align:center;">קודם</th>`:""}</tr></thead><tbody>${tableRows}</tbody></table></div>` : ""}

<div class="footer">
<span>Garden of Eden Football Academy</span><span>דף 1 מתוך 2</span><span>${today}</span>
</div>
</div>

<!-- PAGE 2 -->
<div class="page page-2">
<div style="border-top:3px solid #22c55e;padding-top:16px;margin-bottom:16px;">
<div style="font-size:18px;font-weight:700;">${profile.full_name ?? ""} — ניתוח מפורט</div>
</div>

<div style="display:flex;gap:24px;margin-bottom:20px;">
${stats && radarSvg ? `<div style="flex-shrink:0;"><div style="font-size:14px;font-weight:700;margin-bottom:8px;">מפת מיומנויות</div>${radarSvg}</div>` : ""}
<div style="flex:1;">
<div style="font-size:14px;font-weight:700;margin-bottom:8px;">הדגשים</div>
<div style="margin-bottom:12px;"><div style="font-size:11px;color:#9ca3af;margin-bottom:4px;">דירוג כולל</div><div style="font-size:48px;font-weight:900;color:#22c55e;line-height:1;">${stats?.overall_rating ?? "—"}</div><div style="font-size:11px;color:#6b7280;margin-top:4px;">${assessments.length} מבדקים</div></div>
${assessments.length >= 2 ? `<div><div style="font-size:11px;color:#9ca3af;margin-bottom:6px;">שיפורים מדידים</div>${improvementsHtml}</div>` : ""}
</div>
</div>

<div style="font-size:14px;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #1f2937;">מגמות התפתחות</div>
${assessments.length < 2
  ? `<div style="color:#6b7280;font-size:12px;padding:16px 0;">אין מספיק מבדקים להצגת מגמות</div>`
  : `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px;">${miniChartsHtml}</div>`}

<div class="footer">
<span>Garden of Eden Football Academy</span><span>דף 2 מתוך 2</span><span>${today}</span>
</div>
</div>
</body>
</html>`;
}
```

- [ ] **Step 2: Run tests — verify they pass**

```bash
npx vitest run src/lib/exports/__tests__/player-report-html.test.ts
```

Expected: All 22 tests PASS.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/exports/player-report-html.ts src/lib/exports/__tests__/player-report-html.test.ts
git commit -m "feat(pdf): add buildPlayerReportHtml server-side HTML template"
```

---

## Chunk 3: API Route

### Task 6: Write failing schema tests

**Files:**
- Create: `src/app/api/player-report/__tests__/pdf-schema.test.ts`

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect } from "vitest";
import { playerReportPdfBodySchema } from "../pdf/schema";

const validAssessment = {
  id: "1", user_id: "u1", assessment_date: "2026-01-01", created_at: "2026-01-01T00:00:00Z",
  sprint_5m: null, sprint_10m: null, sprint_20m: null,
  jump_2leg_height: null, jump_2leg_distance: null, jump_right_leg: null, jump_left_leg: null,
  blaze_spot_time: null, kick_power_kaiser: null,
  flexibility_ankle: null, flexibility_knee: null, flexibility_hip: null,
  coordination: null, leg_power_technique: null, body_structure: null,
  concentration_notes: null, decision_making_notes: null, work_ethic_notes: null,
  recovery_notes: null, nutrition_notes: null, assessed_by: null, notes: null,
};

const validBody = {
  profile: {
    full_name: "ישראל", birthdate: "2010-01-01", position: "ST",
    club: "מועדון", created_at: "2024-01-01T00:00:00Z", processed_avatar_url: null,
  },
  assessments: [],
  stats: null,
  attendance: null,
  summary: "",
  strengths: [],
  weaknesses: [],
  socialSkills: [],
};

describe("playerReportPdfBodySchema", () => {
  it("accepts a valid body", () => {
    expect(() => playerReportPdfBodySchema.parse(validBody)).not.toThrow();
  });

  it("rejects missing profile", () => {
    expect(() => playerReportPdfBodySchema.parse({ ...validBody, profile: undefined })).toThrow();
  });

  it("accepts null stats", () => {
    const result = playerReportPdfBodySchema.parse(validBody);
    expect(result.stats).toBeNull();
  });

  it("accepts null attendance", () => {
    const result = playerReportPdfBodySchema.parse(validBody);
    expect(result.attendance).toBeNull();
  });

  it("accepts full stats object", () => {
    const body = {
      ...validBody,
      stats: { overall_rating: 75, pace: 80, shooting: 70, passing: 72, dribbling: 78, defending: 65, physical: 77, card_type: "gold" },
    };
    expect(() => playerReportPdfBodySchema.parse(body)).not.toThrow();
  });

  it("accepts strengths as string array", () => {
    const result = playerReportPdfBodySchema.parse({ ...validBody, strengths: ["מהיר", "חזק"] });
    expect(result.strengths).toEqual(["מהיר", "חזק"]);
  });

  it("rejects invalid coordination enum in assessment", () => {
    const body = {
      ...validBody,
      assessments: [{ ...validAssessment, coordination: "invalid_value" }],
    };
    expect(() => playerReportPdfBodySchema.parse(body)).toThrow();
  });

  it("accepts valid coordination enum", () => {
    const body = {
      ...validBody,
      assessments: [{ ...validAssessment, coordination: "advanced" }],
    };
    expect(() => playerReportPdfBodySchema.parse(body)).not.toThrow();
  });

  it("accepts valid body_structure enum", () => {
    const body = {
      ...validBody,
      assessments: [{ ...validAssessment, body_structure: "good_build" }],
    };
    expect(() => playerReportPdfBodySchema.parse(body)).not.toThrow();
  });

  it("rejects invalid body_structure enum", () => {
    const body = {
      ...validBody,
      assessments: [{ ...validAssessment, body_structure: "invalid" }],
    };
    expect(() => playerReportPdfBodySchema.parse(body)).toThrow();
  });

  it("requires created_at in profile", () => {
    const { created_at: _omitted, ...profileWithout } = validBody.profile;
    expect(() => playerReportPdfBodySchema.parse({ ...validBody, profile: profileWithout })).toThrow();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/app/api/player-report/__tests__/pdf-schema.test.ts
```

Expected: FAIL — `Cannot find module '../pdf/schema'`

---

### Task 7: Create the Zod schema

**Files:**
- Create: `src/app/api/player-report/pdf/schema.ts`

- [ ] **Step 1: Create file**

```typescript
import { z } from "zod";

const playerAssessmentSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  assessment_date: z.string(),
  sprint_5m: z.number().nullable(),
  sprint_10m: z.number().nullable(),
  sprint_20m: z.number().nullable(),
  jump_2leg_height: z.number().nullable(),
  jump_2leg_distance: z.number().nullable(),
  jump_right_leg: z.number().nullable(),
  jump_left_leg: z.number().nullable(),
  blaze_spot_time: z.number().nullable(),
  kick_power_kaiser: z.number().nullable(),
  flexibility_ankle: z.number().nullable(),
  flexibility_knee: z.number().nullable(),
  flexibility_hip: z.number().nullable(),
  coordination: z.enum(["basic", "advanced", "deficient"]).nullable(),
  leg_power_technique: z.enum(["normal", "deficient"]).nullable(),
  body_structure: z.enum(["thin_weak", "good_build", "strong_athletic"]).nullable(),
  concentration_notes: z.string().nullable(),
  decision_making_notes: z.string().nullable(),
  work_ethic_notes: z.string().nullable(),
  recovery_notes: z.string().nullable(),
  nutrition_notes: z.string().nullable(),
  assessed_by: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

export const playerReportPdfBodySchema = z.object({
  profile: z.object({
    full_name: z.string().nullable(),
    birthdate: z.string().nullable(),
    position: z.string().nullable(),
    club: z.string().nullable(),
    created_at: z.string(),
    processed_avatar_url: z.string().nullable(),
  }),
  assessments: z.array(playerAssessmentSchema),
  stats: z.object({
    overall_rating: z.number(),
    pace: z.number(),
    shooting: z.number(),
    passing: z.number(),
    dribbling: z.number(),
    defending: z.number(),
    physical: z.number(),
    card_type: z.string().nullable(),
  }).nullable(),
  attendance: z.object({
    totalSessions: z.number(),
    weeklyAverage: z.number(),
  }).nullable(),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  socialSkills: z.array(z.string()),
});

export type PlayerReportPdfBody = z.infer<typeof playerReportPdfBodySchema>;
```

- [ ] **Step 2: Run schema tests — verify they pass**

```bash
npx vitest run src/app/api/player-report/__tests__/pdf-schema.test.ts
```

Expected: All 11 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/player-report/pdf/schema.ts src/app/api/player-report/__tests__/pdf-schema.test.ts
git commit -m "feat(pdf): add Zod schema for player report PDF request body"
```

---

### Task 8: Create the API route

**Files:**
- Create: `src/app/api/player-report/pdf/route.ts`

This is the POST handler. Auth → SSRF-guarded avatar fetch → HTML build → Puppeteer render → PDF response.

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import {
  buildPlayerReportHtml,
  loadStaticAssets,
} from "@/lib/exports/player-report-html";
import { playerReportPdfBodySchema } from "./schema";

export const runtime = "nodejs";
export const maxDuration = 60;

async function fetchAvatarAsBase64(url: string | null): Promise<string | null> {
  if (!url) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || !url.startsWith(supabaseUrl)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const b64 = Buffer.from(buffer).toString("base64");
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { error } = await verifyAdminOrTrainer();
  if (error) {
    return NextResponse.json({ error: "נדרשת הרשאת מנהל או מאמן" }, { status: 401 });
  }

  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין" }, { status: 400 });
  }

  const parsed = playerReportPdfBodySchema.safeParse(bodyRaw);
  if (!parsed.success) {
    return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
  }

  const data = parsed.data;

  let pdf: Buffer;
  let browser: Awaited<ReturnType<typeof import("puppeteer-core").default.launch>> | undefined;

  try {
    // loadStaticAssets is synchronous (readFileSync); call it directly before the async avatar fetch
    const assets = loadStaticAssets();
    const avatarDataUri = await fetchAvatarAsBase64(data.profile.processed_avatar_url);

    const html = buildPlayerReportHtml(
      {
        profile: data.profile,
        assessments: data.assessments,
        stats: data.stats,
        attendance: data.attendance,
        summary: data.summary,
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        socialSkills: data.socialSkills,
        avatarDataUri,
      },
      assets,
    );

    const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);

    const executablePath =
      process.env.LOCAL_CHROME_PATH ?? (await chromium.executablePath());

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 794, height: 1123 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle2" });
    // Buffer.from() normalises Uint8Array (puppeteer-core v21+) and Buffer equally
    pdf = Buffer.from(await page.pdf({ format: "A4", printBackground: true }));
  } catch (err) {
    console.error("[player-report/pdf]", err);
    return NextResponse.json({ error: "שגיאה ביצירת ה-PDF" }, { status: 500 });
  } finally {
    await browser?.close();
  }

  const playerName = data.profile.full_name ?? "שחקן";
  const date = new Date().toISOString().split("T")[0];
  const encodedFilename = encodeURIComponent(`סיכום-שחקן-${playerName}-${date}.pdf`);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedFilename}`,
    },
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/player-report/pdf/route.ts
git commit -m "feat(pdf): add POST /api/player-report/pdf route with Puppeteer"
```

---

## Chunk 4: Component Updates

### Task 9: Update ReportChartsSection.tsx — remove refs

**Files:**
- Modify: `src/features/player-report/components/ReportChartsSection.tsx:25-37,47,61`

- [ ] **Step 1: Remove radarRef and trendsRef from props interface and div wrappers**

Replace the entire file content with:

```typescript
"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportData } from "../types";
import type { PlayerAssessment } from "@/types/assessment";

const RadarStatsChart = dynamic(
  () =>
    import("@/features/progress-charts/components/RadarStatsChart").then(
      (m) => m.RadarStatsChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-[300px]" /> },
);

const AssessmentProgressCharts = dynamic(
  () =>
    import(
      "@/features/progress-charts/components/AssessmentProgressCharts"
    ).then((m) => m.AssessmentProgressCharts),
  { ssr: false, loading: () => <Skeleton className="h-[400px]" /> },
);

interface ReportChartsSectionProps {
  stats: ReportData["stats"];
  assessments: readonly PlayerAssessment[];
}

export function ReportChartsSection({
  stats,
  assessments,
}: ReportChartsSectionProps) {
  return (
    <div className="space-y-4">
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>דירוג שחקן</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <RadarStatsChart stats={stats} height={350} />
            </div>
          </CardContent>
        </Card>
      )}

      {assessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>מגמות התפתחות</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <AssessmentProgressCharts assessments={assessments} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: Errors only for the `radarRef`/`trendsRef` still passed by `ReportEditor` (not yet updated). These will be fixed in Task 11.

- [ ] **Step 3: Commit**

```bash
git add src/features/player-report/components/ReportChartsSection.tsx
git commit -m "refactor(pdf): remove radarRef and trendsRef from ReportChartsSection"
```

---

### Task 10: Rewrite PlayerReportPdfButton.tsx — fetch-based

**Files:**
- Modify: `src/features/player-report/components/PlayerReportPdfButton.tsx`

Remove all `html-to-image`, `@react-pdf/renderer`, and ref props. Replace with a `fetch` call to the new route.

- [ ] **Step 1: Rewrite the component**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ReportData } from "../types";
import type { BulletItem } from "./ReportBulletList";

interface PlayerReportPdfButtonProps {
  data: ReportData;
  strengths: readonly BulletItem[];
  weaknesses: readonly BulletItem[];
  socialSkills: readonly BulletItem[];
  summary: string;
}

export function PlayerReportPdfButton({
  data,
  strengths,
  weaknesses,
  socialSkills,
  summary,
}: PlayerReportPdfButtonProps) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const body = {
        profile: {
          full_name: data.profile.full_name,
          birthdate: data.profile.birthdate,
          position: data.profile.position,
          club: data.profile.club,
          created_at: data.profile.created_at,
          processed_avatar_url: data.profile.processed_avatar_url,
        },
        assessments: data.assessments,
        stats: data.stats,
        attendance: data.attendance
          ? { totalSessions: data.attendance.totalSessions, weeklyAverage: data.attendance.weeklyAverage }
          : null,
        summary,
        strengths: strengths.map((s) => s.text),
        weaknesses: weaknesses.map((w) => w.text),
        socialSkills: socialSkills.map((s) => s.text),
      };

      const response = await fetch("/api/player-report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const { error } = (await response.json()) as { error: string };
        toast.error(error ?? "שגיאה ביצירת ה-PDF");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const name = data.profile.full_name ?? "report";
      const date = new Date().toISOString().split("T")[0];
      link.download = `סיכום-שחקן-${name}-${date}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 200);
    } catch (err) {
      console.error("[PlayerReportPdfButton] PDF generation failed:", err);
      toast.error("שגיאה ביצירת ה-PDF, נסה שוב");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button onClick={handleGenerate} disabled={generating} data-testid="download-pdf">
      {generating ? (
        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4 ml-2" />
      )}
      {generating ? "מייצר PDF..." : "הורד PDF"}
    </Button>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: Only errors from `ReportEditor` still passing old props. These will be fixed in Task 11.

- [ ] **Step 3: Commit**

```bash
git add src/features/player-report/components/PlayerReportPdfButton.tsx
git commit -m "refactor(pdf): rewrite PlayerReportPdfButton to POST to /api/player-report/pdf"
```

---

### Task 11: Update ReportEditor.tsx — remove refs and hidden card

**Files:**
- Modify: `src/features/player-report/components/ReportEditor.tsx`

Remove: `useRef` import, `radarRef`/`trendsRef`/`fifaCardRef` declarations, ref props passed to `PlayerReportPdfButton` and `ReportChartsSection`, hidden `PlayerCard` div, `PlayerCard`/`CardType`/`PlayerPosition` imports.

- [ ] **Step 1: Rewrite the component**

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ReportDetailsSection } from "./ReportDetailsSection";
import { ReportAssessmentsTable } from "./ReportAssessmentsTable";
import { ReportChartsSection } from "./ReportChartsSection";
import { ReportBulletList, type BulletItem } from "./ReportBulletList";
import { ReportSummarySection } from "./ReportSummarySection";
import { PlayerReportPdfButton } from "./PlayerReportPdfButton";
import { getReportData } from "../lib/actions";
import type { ReportData } from "../types";

interface ReportEditorProps {
  initialData: ReportData;
  userId: string;
  initialFromDate: string;
  initialToDate: string;
}

export function ReportEditor({
  initialData,
  userId,
  initialFromDate,
  initialToDate,
}: ReportEditorProps) {
  const [data, setData] = useState(initialData);
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [isPending, startTransition] = useTransition();

  const [strengths, setStrengths] = useState<readonly BulletItem[]>(
    initialData.strengths.map((s) => ({ id: s.id, text: s.text })),
  );
  const [weaknesses, setWeaknesses] = useState<readonly BulletItem[]>(
    initialData.weaknesses.map((w) => ({ id: w.id, text: w.text })),
  );
  const [socialSkills, setSocialSkills] = useState<readonly BulletItem[]>(
    initialData.socialSkills.map((s) => ({ id: s.id, text: s.text })),
  );
  const [summary, setSummary] = useState(
    initialData.latestSummary?.summary ?? "",
  );

  const handleDateRangeChange = () => {
    startTransition(async () => {
      const { data: newData, error } = await getReportData(userId, fromDate, toDate);
      if (error) {
        toast.error(error);
        return;
      }
      if (newData) {
        setData(newData);
        setStrengths(newData.strengths.map((s) => ({ id: s.id, text: s.text })));
        setWeaknesses(newData.weaknesses.map((w) => ({ id: w.id, text: w.text })));
        setSocialSkills(newData.socialSkills.map((s) => ({ id: s.id, text: s.text })));
        setSummary(newData.latestSummary?.summary ?? "");
      }
    });
  };

  return (
    <div className="space-y-6" data-testid="report-editor">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold" data-testid="report-title">
          סיכום פעילות שחקן - {data.profile.full_name}
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="fromDate">מ-</Label>
            <Input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-auto"
            />
            <Label htmlFor="toDate">עד</Label>
            <Input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-auto"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleDateRangeChange}
              disabled={isPending}
              data-testid="update-date-range"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "עדכן"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <PlayerReportPdfButton
          data={data}
          strengths={strengths}
          weaknesses={weaknesses}
          socialSkills={socialSkills}
          summary={summary}
        />
      </div>

      <ReportDetailsSection profile={data.profile} attendance={data.attendance} />
      <ReportAssessmentsTable assessments={data.assessments} />
      <ReportChartsSection stats={data.stats} assessments={data.assessments} />

      <ReportBulletList
        title="נקודות חוזקה / פרמטרים ששופרו"
        items={strengths}
        onChange={setStrengths}
        headerClassName="text-green-600"
        testIdPrefix="strengths"
      />
      <ReportBulletList
        title="מיקוד לשיפור בהמשך התהליך"
        items={weaknesses}
        onChange={setWeaknesses}
        headerClassName="text-amber-600"
        testIdPrefix="weaknesses"
      />
      <ReportBulletList
        title="כישורים חברתיים"
        items={socialSkills}
        onChange={setSocialSkills}
        headerClassName="text-indigo-600"
        testIdPrefix="social-skills"
      />

      {/* key forces remount when data refreshes (CLAUDE.md gotcha: useState(prop)) */}
      <ReportSummarySection
        key={data.latestSummary?.id ?? "no-summary"}
        userId={userId}
        initialSummary={data.latestSummary?.summary ?? ""}
        onSummaryChange={setSummary}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check — expect clean**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run all tests**

```bash
npm run test:run
```

Expected: All existing tests pass plus all new tests from Tasks 4 and 6.

- [ ] **Step 4: Commit**

```bash
git add src/features/player-report/components/ReportEditor.tsx
git commit -m "refactor(pdf): remove html-to-image refs and hidden PlayerCard from ReportEditor"
```

---

### Task 12: Final build verification

- [ ] **Step 1: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds with no errors. Ignore "Route /api/player-report/pdf has maxDuration set" warning — this is expected on Hobby plan.

- [ ] **Step 2: Run full test suite**

```bash
npm run test:run
```

Expected: All tests pass.

- [ ] **Step 3: Final commit if any stray changes**

```bash
git status
```

If clean: done. If any uncommitted changes remain, commit them with appropriate message.
