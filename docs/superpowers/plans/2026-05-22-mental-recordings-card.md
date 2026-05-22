# Mental Session Recordings Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a card to the trainee dashboard that opens a public Google Drive folder of past mental ("zoom meetup") session recordings in a new browser tab.

**Architecture:** One new static presentational component (`MentalRecordingsCard`) with no props, state, or data fetching — it renders a `Card` whose action button is an anchor to the Drive folder. It is rendered once in the existing dashboard server component.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), Tailwind CSS 4, Radix-based `Card`/`Button` UI primitives, `lucide-react` icons.

---

## File Structure

- **Create:** `src/components/dashboard/MentalRecordingsCard.tsx` — the standalone card component. Holds the Drive URL constant and all markup. Mirrors the existing `src/components/dashboard/NextGameCard.tsx` empty-state layout.
- **Modify:** `src/app/dashboard/page.tsx` — add one import and render the card once, between `<ClipUploadCard />` and the "Quick Actions" section.

No tests: per the project convention (`CLAUDE.md`), automated tests cover pure utility functions only. This component has no logic — it is verified by type-check, lint, build, and a manual browser check.

---

### Task 1: Create the MentalRecordingsCard component

**Files:**
- Create: `src/components/dashboard/MentalRecordingsCard.tsx`

- [ ] **Step 1: Create the component file**

Create `src/components/dashboard/MentalRecordingsCard.tsx` with exactly this content:

```tsx
import { Brain, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Public Google Drive folder ("anyone with the link can view") holding
// recordings of past mental zoom sessions. The ?hl=he tracking param from the
// original share link is intentionally omitted.
const MENTAL_RECORDINGS_DRIVE_URL =
  "https://drive.google.com/drive/folders/1Pl8dGFPfqHY-wZ-AKVdgtuvzhZ4n4WzK";

export function MentalRecordingsCard() {
  return (
    <Card>
      <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-5">
        <div className="flex items-center gap-4 flex-1">
          <div className="bg-indigo-500 rounded-full p-2 shrink-0">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-semibold">הקלטות מפגשי מנטל</p>
            <p className="text-sm text-muted-foreground">
              צפו בהקלטות ממפגשי הזום הקודמים בנושא מנטליות
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0 self-start sm:self-auto">
          <a
            href={MENTAL_RECORDINGS_DRIVE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4 ml-1" />
            לצפייה בהקלטות
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check the new file**

Run: `npx tsc --noEmit`
Expected: PASS — no errors. (The PostToolUse hook also runs `tsc --noEmit` automatically on save; this is a redundant explicit check.)

- [ ] **Step 3: Lint the new file**

Run: `npm run lint`
Expected: PASS — no errors or warnings for `MentalRecordingsCard.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/MentalRecordingsCard.tsx
git commit -m "feat(dashboard): add mental recordings card component"
```

---

### Task 2: Render the card on the trainee dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add the import**

In `src/app/dashboard/page.tsx`, the import block currently contains this line (around line 33):

```tsx
import { ClipUploadCard } from "@/components/dashboard/ClipUploadCard";
```

Add the following line immediately after it:

```tsx
import { MentalRecordingsCard } from "@/components/dashboard/MentalRecordingsCard";
```

- [ ] **Step 2: Render the card after the Trainee Clip section**

In the same file, find the "Trainee Clip" block in the JSX, which ends like this:

```tsx
      {/* Trainee Clip */}
      <ClipUploadCard
        clip={
          ownClipWithUrl
            ? {
                uploaded_at: ownClipWithUrl.clip.uploaded_at,
                mime_type: ownClipWithUrl.clip.mime_type,
                signedUrl: ownClipWithUrl.signedUrl,
              }
            : null
        }
      />

      {/* Quick Actions */}
```

Insert the new card between the closing `/>` of `ClipUploadCard` and the `{/* Quick Actions */}` comment, so the result reads:

```tsx
      {/* Trainee Clip */}
      <ClipUploadCard
        clip={
          ownClipWithUrl
            ? {
                uploaded_at: ownClipWithUrl.clip.uploaded_at,
                mime_type: ownClipWithUrl.clip.mime_type,
                signedUrl: ownClipWithUrl.signedUrl,
              }
            : null
        }
      />

      {/* Mental Session Recordings */}
      <MentalRecordingsCard />

      {/* Quick Actions */}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS — no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS — no errors or warnings.

- [ ] **Step 5: Production build**

Run: `npm run build`
Expected: PASS — build completes; `/dashboard` compiles without errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard): show mental recordings card on trainee dashboard"
```

---

## Manual Verification

After Task 2, verify in the browser (`npm run dev`, log in as a trainee, open `/dashboard`):

- [ ] The card appears below the Trainee Clip card and above the "פעולות מהירות" (Quick Actions) section.
- [ ] Title `הקלטות מפגשי מנטל` and description render right-to-left, correctly aligned.
- [ ] The `לצפייה בהקלטות` button opens the Drive folder in a new browser tab.
- [ ] Layout is correct at mobile width (~375px — icon/text stacked above the button) and desktop width (~1440px — button aligned to the inline-end).

---

## Self-Review Notes

- **Spec coverage:** Component (Task 1) and integration (Task 2) cover every section of the design spec. Drive URL constant, `?hl=he` stripped, `Brain` icon, `bg-indigo-500` tile, exact Hebrew strings, `target="_blank"` + `rel="noopener noreferrer"`, placement after `ClipUploadCard` — all present.
- **No tests:** Matches the spec and `CLAUDE.md` (tests cover pure utilities only).
- **Type consistency:** Exported symbol is `MentalRecordingsCard` in both the component file and the dashboard import — consistent.
