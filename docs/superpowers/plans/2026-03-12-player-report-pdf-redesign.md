# Player Report PDF Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the player report PDF from a plain layout to a professional dark scout-report style with FIFA card, two-column summary, improvement-highlighted assessment table, and per-metric progress charts on page 2.

**Architecture:** 6 targeted file changes — types extend, data layer adds two columns, snapshot utility gains a param, ReportEditor adds a hidden PlayerCard, PdfButton captures it, and the PDF template is fully rewritten as a dark 2-page document.

**Tech Stack:** @react-pdf/renderer (PDF), html-to-image (chart/card capture), Vitest (pure util tests), TypeScript strict, Next.js 16 App Router.

---

## Chunk 1: Data Layer

### Task 1: Extend ReportData types

**Files:**
- Modify: `src/features/player-report/types/index.ts`

- [ ] **Step 1: Edit the file**

In `types/index.ts`, add `processed_avatar_url: string | null` to `profile` and `card_type: string | null` to `stats`:

```typescript
export interface ReportData {
  readonly profile: {
    readonly id: string;
    readonly full_name: string | null;
    readonly birthdate: string | null;
    readonly position: string | null;
    readonly club: string | null;
    readonly avatar_url: string | null;
    readonly processed_avatar_url: string | null;   // ADD
    readonly created_at: string;
  };
  readonly assessments: readonly PlayerAssessment[];
  readonly stats: {
    readonly overall_rating: number;
    readonly pace: number;
    readonly shooting: number;
    readonly passing: number;
    readonly dribbling: number;
    readonly defending: number;
    readonly physical: number;
    readonly card_type: string | null;              // ADD
  } | null;
  // ... rest unchanged
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (callers don't pass processed_avatar_url yet — that's OK until Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/features/player-report/types/index.ts
git commit -m "feat(player-report): add processed_avatar_url and card_type to ReportData types"
```

---

### Task 2: Fetch new fields in get-report-data.ts

**Files:**
- Modify: `src/features/player-report/lib/actions/get-report-data.ts`

- [ ] **Step 1: Add processed_avatar_url to profiles select**

Change line 35 from:
```typescript
.select("id, full_name, birthdate, position, club, avatar_url, created_at, arbox_user_id, role")
```
To:
```typescript
.select("id, full_name, birthdate, position, club, avatar_url, processed_avatar_url, created_at, arbox_user_id, role")
```

- [ ] **Step 2: Add card_type to player_stats select**

Change line 59 from:
```typescript
.select("overall_rating, pace, shooting, passing, dribbling, defending, physical")
```
To:
```typescript
.select("overall_rating, pace, shooting, passing, dribbling, defending, physical, card_type")
```

- [ ] **Step 3: Include both in the return object**

In the `return` block, update `profile` and `stats`:

```typescript
profile: {
  id: profile.id,
  full_name: profile.full_name,
  birthdate: profile.birthdate,
  position: profile.position,
  club: profile.club,
  avatar_url: profile.avatar_url,
  processed_avatar_url: profile.processed_avatar_url ?? null,  // ADD
  created_at: profile.created_at,
},
// ...
stats: stats
  ? {
      overall_rating: stats.overall_rating,
      pace: stats.pace,
      shooting: stats.shooting,
      passing: stats.passing,
      dribbling: stats.dribbling,
      defending: stats.defending,
      physical: stats.physical,
      card_type: stats.card_type ?? null,  // ADD
    }
  : null,
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/player-report/lib/actions/get-report-data.ts
git commit -m "feat(player-report): select processed_avatar_url and card_type from DB"
```

---

## Chunk 2: Capture Utilities + UI

### Task 3: Add backgroundColor param to chart-snapshot.ts

**Files:**
- Modify: `src/features/player-report/lib/utils/chart-snapshot.ts`

- [ ] **Step 1: Edit the function signature**

```typescript
import { toPng } from "html-to-image";

export async function captureChartAsImage(
  element: HTMLElement | null,
  backgroundColor: string | undefined = "#ffffff",
): Promise<string | null> {
  if (!element) return null;

  try {
    const dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor,
    });
    return dataUrl;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (existing callers omit the param, which now defaults to `"#ffffff"` — identical previous behavior).

- [ ] **Step 3: Commit**

```bash
git add src/features/player-report/lib/utils/chart-snapshot.ts
git commit -m "feat(player-report): add optional backgroundColor param to captureChartAsImage"
```

---

### Task 4: Add hidden PlayerCard to ReportEditor.tsx

**Files:**
- Modify: `src/features/player-report/components/ReportEditor.tsx`

The hidden card is rendered off-screen so `html-to-image` can capture it. It uses `visibility: hidden` with `position: absolute` so it doesn't affect layout.

- [ ] **Step 1: Add the fifaCardRef and PlayerCard import**

Add at the top of imports:
```typescript
import { PlayerCard } from "@/components/player-card/PlayerCard";
import type { CardType, PlayerPosition } from "@/types/player-stats";
```

Add alongside `radarRef`/`trendsRef`:
```typescript
const fifaCardRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 2: Render the hidden PlayerCard**

Add immediately before the closing `</div>` of the return, after the last section:

```tsx
{/* Hidden FIFA card for PDF capture */}
{data.stats && (
  <div
    ref={fifaCardRef}
    style={{
      position: "absolute",
      top: -9999,
      left: -9999,
      visibility: "hidden",
      pointerEvents: "none",
    }}
  >
    <PlayerCard
      playerName={data.profile.full_name ?? ""}
      position={(data.profile.position as PlayerPosition) ?? "ST"}
      cardType={(data.stats.card_type as CardType) ?? "standard"}
      overallRating={data.stats.overall_rating}
      stats={{
        pace: data.stats.pace,
        shooting: data.stats.shooting,
        passing: data.stats.passing,
        dribbling: data.stats.dribbling,
        defending: data.stats.defending,
        physical: data.stats.physical,
      }}
      avatarUrl={data.profile.processed_avatar_url ?? data.profile.avatar_url ?? undefined}
      linkToStats={false}
      size="md"
    />
  </div>
)}
```

- [ ] **Step 3: Pass fifaCardRef to PlayerReportPdfButton**

Change the `<PlayerReportPdfButton` usage to also pass `fifaCardRef`:
```tsx
<PlayerReportPdfButton
  data={data}
  strengths={strengths}
  weaknesses={weaknesses}
  socialSkills={socialSkills}
  summary={summary}
  radarRef={radarRef}
  trendsRef={trendsRef}
  fifaCardRef={fifaCardRef}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Error on `fifaCardRef` prop — PlayerReportPdfButton doesn't accept it yet (fixed in Task 5). That's fine for now; fix in next task.

- [ ] **Step 5: Commit after Task 5 passes type check**

(Combined commit with Task 5 below.)

---

### Task 5: Update PlayerReportPdfButton.tsx to capture FIFA card

**Files:**
- Modify: `src/features/player-report/components/PlayerReportPdfButton.tsx`

- [ ] **Step 1: Add fifaCardRef to props interface**

```typescript
interface PlayerReportPdfButtonProps {
  data: ReportData;
  strengths: readonly BulletItem[];
  weaknesses: readonly BulletItem[];
  socialSkills: readonly BulletItem[];
  summary: string;
  radarRef: React.RefObject<HTMLDivElement | null>;
  trendsRef: React.RefObject<HTMLDivElement | null>;
  fifaCardRef: React.RefObject<HTMLDivElement | null>;  // ADD
}
```

- [ ] **Step 2: Destructure and capture FIFA card image**

Add `fifaCardRef` to the destructure. In `handleGenerate`, add alongside `radarImage`/`trendsImage`:

```typescript
const [radarImage, trendsImage, fifaCardImage] = await Promise.all([
  captureChartAsImage(radarRef.current),
  captureChartAsImage(trendsRef.current),
  captureChartAsImage(fifaCardRef.current, undefined), // transparent bg for FIFA card
]);
```

- [ ] **Step 3: Pass fifaCardImage to the PDF document**

Add `fifaCardImage` to the `<PlayerReportPdfDocument` JSX:
```tsx
const doc = (
  <PlayerReportPdfDocument
    playerName={data.profile.full_name ?? "שחקן"}
    details={{
      birthdate: data.profile.birthdate,
      position: data.profile.position,
      club: data.profile.club,
      registrationDate: data.profile.created_at,
      weeklyAttendance: data.attendance
        ? `${data.attendance.weeklyAverage.toFixed(1)} בשבוע`
        : "לא זמין",
    }}
    stats={data.stats}
    assessments={data.assessments}
    radarChartImage={radarImage}
    trendsChartImage={trendsImage}
    fifaCardImage={fifaCardImage}              // ADD
    strengths={strengths.map((s) => s.text)}
    weaknesses={weaknesses.map((w) => w.text)}
    socialSkills={socialSkills.map((s) => s.text)}
    summary={summary}
    generatedAt={now}
  />
);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Error on `stats` and `fifaCardImage` in `PlayerReportPdfDocument` — that's fixed in Task 6. Types in Task 5 itself should be clean.

- [ ] **Step 5: Commit Tasks 4+5 together**

```bash
git add src/features/player-report/components/ReportEditor.tsx src/features/player-report/components/PlayerReportPdfButton.tsx
git commit -m "feat(player-report): add hidden FIFA card capture to PDF button"
```

---

## Chunk 3: PDF Template Redesign

### Task 6: Full redesign of pdf-player-report-template.tsx

**Files:**
- Modify: `src/lib/exports/pdf-player-report-template.tsx`

This is the largest change. Replace the entire file with the dark scout-report design.

- [ ] **Step 1: Update the props interface**

Add `fifaCardImage: string | null` and `stats: ReportData["stats"]` (to access card data on page 1):

```typescript
export interface PlayerReportPdfDocumentProps {
  playerName: string;
  details: {
    birthdate: string | null;
    position: string | null;
    club: string | null;
    registrationDate: string;
    weeklyAttendance: string;
  };
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
  assessments: readonly PlayerAssessment[];
  radarChartImage: string | null;
  trendsChartImage: string | null;
  fifaCardImage: string | null;       // NEW
  strengths: string[];
  weaknesses: string[];
  socialSkills: string[];
  summary: string;
  generatedAt: string;
}
```

- [ ] **Step 2: Replace styles with dark theme**

Key colors: page bg `#111827`, card bg `#1F2937`, accent `#22c55e`, text white `#F9FAFB`, muted `#9CA3AF`.

```typescript
const C = {
  pageBg: "#111827",
  cardBg: "#1F2937",
  accent: "#22c55e",
  accentAmber: "#f59e0b",
  accentIndigo: "#6366f1",
  white: "#F9FAFB",
  muted: "#9CA3AF",
  border: "#374151",
};

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: C.pageBg,
    padding: 28,
    fontFamily: "Heebo",
  },
  // Header
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 14,
    borderBottom: 1,
    borderBottomColor: C.border,
  },
  headerLeft: {
    flex: 1,
  },
  playerName: {
    fontSize: 26,
    fontWeight: 700,
    color: C.white,
    textAlign: "right",
  },
  metaRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
  },
  chip: {
    backgroundColor: C.cardBg,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 8,
    color: C.muted,
  },
  chipAccent: {
    backgroundColor: C.accent,
    color: C.pageBg,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 8,
    fontWeight: 700,
  },
  fifaCardImage: {
    width: 110,
    height: 154,
    marginLeft: 12,
  },
  // Body two-column
  body: {
    flexDirection: "row-reverse",
    gap: 12,
    marginBottom: 14,
  },
  leftColumn: {
    width: 120,
    backgroundColor: C.cardBg,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
  },
  rightColumn: {
    flex: 1,
  },
  // Left column stats
  statBlock: {
    alignItems: "center",
    marginBottom: 10,
    width: "100%",
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 700,
    color: C.accent,
    textAlign: "center",
    lineHeight: 1,
  },
  statSmallNumber: {
    fontSize: 18,
    fontWeight: 700,
    color: C.white,
    textAlign: "center",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 7,
    color: C.muted,
    textAlign: "center",
    marginTop: 2,
  },
  statDivider: {
    height: 1,
    backgroundColor: C.border,
    width: "100%",
    marginVertical: 6,
  },
  // Right column
  summaryText: {
    fontSize: 9,
    color: C.white,
    textAlign: "right",
    lineHeight: 1.55,
    marginBottom: 8,
  },
  bulletSection: {
    marginTop: 4,
  },
  bulletSectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textAlign: "right",
    marginBottom: 3,
  },
  bulletItem: {
    flexDirection: "row-reverse",
    marginBottom: 2,
  },
  bulletDot: {
    fontSize: 7,
    marginLeft: 4,
    marginTop: 1,
  },
  bulletText: {
    fontSize: 8,
    textAlign: "right",
    flex: 1,
    color: C.white,
  },
  // Assessment table
  tableTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: C.accent,
    textAlign: "right",
    marginBottom: 5,
    marginTop: 12,
  },
  tableHeader: {
    flexDirection: "row-reverse",
    backgroundColor: C.cardBg,
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRadius: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row-reverse",
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottom: 1,
    borderBottomColor: C.border,
  },
  tableRowAlt: {
    backgroundColor: "#161D2B",
  },
  tableCell: {
    flex: 1,
    textAlign: "right",
    fontSize: 8,
    color: C.white,
  },
  tableCellHeader: {
    flex: 1,
    textAlign: "right",
    fontSize: 8,
    fontWeight: 700,
    color: C.muted,
  },
  tableCellImproved: {
    flex: 1,
    textAlign: "right",
    fontSize: 8,
    color: C.accent,
    fontWeight: 700,
  },
  tableCellDeclined: {
    flex: 1,
    textAlign: "right",
    fontSize: 8,
    color: C.accentAmber,
    fontWeight: 700,
  },
  // Page 2 header
  page2Header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: 1,
    borderBottomColor: C.border,
  },
  page2Title: {
    fontSize: 16,
    fontWeight: 700,
    color: C.white,
    textAlign: "right",
  },
  page2Subtitle: {
    fontSize: 10,
    color: C.muted,
    textAlign: "right",
  },
  chartImage: {
    width: "100%",
    marginVertical: 6,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: 1,
    borderTopColor: C.border,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: C.muted,
  },
  footerAccent: {
    fontSize: 7,
    color: C.accent,
    fontWeight: 700,
  },
});
```

- [ ] **Step 3: Implement helper components**

```typescript
// Import compareMetric
import { compareMetric } from "@/features/player-report/lib/utils/metric-comparison";

function BulletSection({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: string;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.bulletSection}>
      <Text style={[styles.bulletSectionTitle, { color }]}>{title}</Text>
      {items.slice(0, 4).map((item, i) => (
        <View key={i} style={styles.bulletItem}>
          <Text style={[styles.bulletDot, { color }]}>{"•"}</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function PageFooter({
  playerName,
  generatedAt,
  pageNum,
}: {
  playerName: string;
  generatedAt: string;
  pageNum: number;
}) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerAccent}>Garden of Eden</Text>
      <Text style={styles.footerText}>עמוד {pageNum}</Text>
      <Text style={styles.footerText}>{playerName} | {generatedAt}</Text>
    </View>
  );
}
```

- [ ] **Step 4: Implement the main export function**

Replace the old `PlayerReportPdfDocument` with the new 2-page dark version (see spec for full layout). Key implementation points:

**Page 1 header:**
```tsx
<View style={styles.header}>
  <View style={styles.headerLeft}>
    <Text style={styles.playerName}>{playerName.toUpperCase()}</Text>
    <View style={styles.metaRow}>
      <Text style={styles.chipAccent}>Garden of Eden</Text>
      {details.position && <Text style={styles.chip}>{details.position}</Text>}
      {details.club && <Text style={styles.chip}>{details.club}</Text>}
      {ageStr && <Text style={styles.chip}>גיל {ageStr}</Text>}
      <Text style={styles.chip}>הצטרפות: {formatDate(details.registrationDate)}</Text>
      <Text style={styles.chip}>נוכחות: {details.weeklyAttendance}</Text>
    </View>
  </View>
  {/* eslint-disable jsx-a11y/alt-text */}
  {fifaCardImage && (
    <Image src={fifaCardImage} style={styles.fifaCardImage} />
  )}
  {/* eslint-enable jsx-a11y/alt-text */}
</View>
```

**Left column (key stats):**
```tsx
<View style={styles.leftColumn}>
  {stats && (
    <>
      <View style={styles.statBlock}>
        <Text style={styles.statNumber}>{stats.overall_rating}</Text>
        <Text style={styles.statLabel}>דירוג כללי</Text>
      </View>
      <View style={styles.statDivider} />
      {/* Best sprint: prefer sprint_10m, fallback sprint_5m */}
      {(latestAssessment?.sprint_10m ?? latestAssessment?.sprint_5m) && (
        <View style={styles.statBlock}>
          <Text style={styles.statSmallNumber}>
            {latestAssessment?.sprint_10m ?? latestAssessment?.sprint_5m}
          </Text>
          <Text style={styles.statLabel}>ספרינט (שנ')</Text>
        </View>
      )}
      {latestAssessment?.jump_2leg_height && (
        <View style={styles.statBlock}>
          <Text style={styles.statSmallNumber}>{latestAssessment.jump_2leg_height}</Text>
          <Text style={styles.statLabel}>קפיצה (ס"מ)</Text>
        </View>
      )}
      {latestAssessment?.kick_power_kaiser && (
        <View style={styles.statBlock}>
          <Text style={styles.statSmallNumber}>{latestAssessment.kick_power_kaiser}</Text>
          <Text style={styles.statLabel}>כוח בעיטה (W)</Text>
        </View>
      )}
    </>
  )}
</View>
```

**Assessment table** (uses `compareMetric` for row coloring):
```tsx
{recent.length > 0 && (
  <>
    <Text style={styles.tableTitle}>מבדקים גופניים</Text>
    <View style={styles.tableHeader}>
      <Text style={styles.tableCellHeader}>מדד</Text>
      {recent.map((a) => (
        <Text key={a.id} style={styles.tableCellHeader}>
          {formatDate(a.assessment_date)}
        </Text>
      ))}
    </View>
    {METRIC_KEYS.map((key, rowIdx) => {
      const latest = recent[0]?.[key] ?? null;
      const previous = recent[1]?.[key] ?? null;
      const result = compareMetric(String(key), latest as string | number | null, previous as string | number | null);
      const isImproved = result === "improved";
      const isDeclined = result === "declined";
      return (
        <View key={key} style={[styles.tableRow, rowIdx % 2 === 1 ? styles.tableRowAlt : {}]}>
          <Text style={styles.tableCellHeader}>{ASSESSMENT_LABELS_HE[key] ?? key}</Text>
          <Text style={isImproved ? styles.tableCellImproved : isDeclined ? styles.tableCellDeclined : styles.tableCell}>
            {String(latest ?? "---")}
          </Text>
          {recent.length > 1 && (
            <Text style={styles.tableCell}>{String(previous ?? "---")}</Text>
          )}
        </View>
      );
    })}
  </>
)}
```

**Page 2:**
```tsx
<Page size="A4" style={styles.page}>
  <View style={styles.page2Header}>
    <View>
      <Text style={styles.page2Title}>{playerName} — ניתוח התקדמות</Text>
    </View>
    <Text style={styles.page2Subtitle}>{generatedAt}</Text>
  </View>

  {/* eslint-disable jsx-a11y/alt-text */}
  {radarChartImage && (
    <Image src={radarChartImage} style={styles.chartImage} />
  )}
  {trendsChartImage && (
    <Image src={trendsChartImage} style={styles.chartImage} />
  )}
  {/* eslint-enable jsx-a11y/alt-text */}

  <PageFooter playerName={playerName} generatedAt={generatedAt} pageNum={2} />
</Page>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Build check**

Run: `npm run build`
Expected: Successful build (PDF template is dynamically imported so no SSR issues).

- [ ] **Step 7: Commit**

```bash
git add src/lib/exports/pdf-player-report-template.tsx
git commit -m "feat(player-report): redesign PDF as dark scout-report with FIFA card and improvement table"
```

- [ ] **Step 8: Final commit and push**

```bash
git push
```

---

## Notes

- `captureChartAsImage(fifaCardRef.current, undefined)` passes `undefined` as background color. The `toPng` option `backgroundColor: undefined` means transparent — preserving the FIFA card's gold gradient.
- The `PlayerCard` uses Framer Motion's `motion.div`. When captured with `html-to-image`, Framer Motion applies static computed styles, so the card renders correctly without animation.
- The `fixed` prop on `<PageFooter>` repeats the footer on both pages automatically in `@react-pdf/renderer`.
- Bullet items are capped at 4 per section (`items.slice(0, 4)`) to fit page 1.
- `latestAssessment` is `assessments[0]` (sorted newest first by the DB query).
- Age calculation: `Math.floor((Date.now() - new Date(birthdate).getTime()) / (365.25 * 24 * 3600 * 1000))`.
