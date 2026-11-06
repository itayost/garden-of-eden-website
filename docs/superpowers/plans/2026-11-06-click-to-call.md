# Click-to-call Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `tel:` call link in leads and retention that records a call attempt, plus a reminder to the calling trainer 10 minutes later if the call is still undocumented.

**Architecture:** Attempts live in `call_attempts`; whether one is documented is derived from `lead_contact_log` / the new `retention_call_log` rows by the same author after the tap. One pure module decides what is due; server actions (service role, behind `verifyAdminOrTrainer`) read and write; a client watcher in the admin layout shows due reminders.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase, Zod, Vitest, sonner, Radix (shadcn/ui).

**Spec:** `docs/superpowers/specs/2026-11-06-click-to-call-design.md`

## Global Constraints

- Delay 10 minutes (`CALL_REMINDER_DELAY_MS = 600_000`); attempts older than 7 days never remind (`CALL_REMINDER_WINDOW_MS = 7 * 86_400_000`); poll every 60 s.
- Phones are stored and compared as E.164 from `normalizePhoneIL()`; `tel:` hrefs are `tel:+972XXXXXXXXX`.
- All UI text Hebrew, RTL, logical properties (`start`/`end`), no emojis, immutable updates.
- New tables: RLS on, no policies, `REVOKE ALL ... FROM anon, authenticated`; reached only through server actions with `createAdminClient()`.
- Retention paths call `assertPhoneInScope()`; lead paths keep `verifyAdminOrTrainer()` only. Reads of attempts and documentation are always filtered by the signed-in user's id.
- Copy fixed by the spec: "התזכורת לתיעוד השיחה לא נשמרה", "לא תיעדת את השיחה", "תיעוד", "לא התקיימה שיחה", "תיעוד שיחה", column "שיחה".

## Review Focus

- A retention phone from Arbox in local format ("050-...") must match the same customer's log entry: store and compare only normalized E.164 (rules test: documentation keyed by E.164 matches an attempt created from a local-format phone, via the action normalizing first; validations test rejects a non-E.164 stored phone).
- A lead phone stored as bare `972...` must still produce a working `tel:` link (rules test `telHref("972501234567")`).
- The tab is hidden while the dialer is open and timers are throttled: the watcher must refresh on `visibilitychange` to visible and on `focus`, not only on its interval.
- Two fast taps insert two attempts: the reminder shows once per person and one dismissal clears both (rules test: two open attempts for one lead give one reminder, earliest start).
- A documentation entry written before the tap, or by another trainer, must not clear the reminder (rules tests for both).

---

### Task 1: Pure rules and schemas

**Files:**
- Create: `src/features/call-reminders/lib/rules.ts`
- Create: `src/features/call-reminders/lib/validations.ts`
- Test: `src/features/call-reminders/lib/__tests__/rules.test.ts`, `src/features/call-reminders/lib/__tests__/validations.test.ts`

**Interfaces:**
- Produces:
  - `type CallTarget = { kind: "lead"; leadId: string } | { kind: "retention"; reportMonth: string; phone: string }`
  - `targetKey(t: CallTarget): string` (`lead:<id>` / `retention:<E.164>`; month is not part of the key)
  - `telHref(phone: string | null | undefined): string | null`
  - `interface AttemptRow { id: string; target: CallTarget; contactName: string; startedAt: string; dismissedAt: string | null }`
  - `interface DocumentationRow { targetKey: string; createdAt: string }` (already filtered to the caller by the query)
  - `interface DueReminder { attemptId: string; target: CallTarget; contactName: string; startedAt: string }`
  - `reminderState(attempts: readonly AttemptRow[], docs: readonly DocumentationRow[], nowMs: number): { due: readonly DueReminder[]; nextDueAt: string | null }`
  - `openAttemptFor(attempts, docs, target, nowMs): AttemptRow | null` (the earliest open, undocumented attempt for a target inside the window; used for repeat taps)
  - `callTargetSchema` (Zod, discriminated on `kind`; lead id UUID; retention month `YYYY-MM-01`, phone transformed by `normalizePhoneIL` and required to be E.164)
  - `retentionCallLogSchema` (`{ reportMonth, phone, traineeName (1-200), outcome: enum LEAD_CONTACT_OUTCOMES, notes: string <= 2000 optional }`)

- [ ] **Step 1: Write the failing tests**

`rules.test.ts` (fix `now` at `2026-11-06T10:00:00Z`):
- `telHref("972501234567")`, `telHref("050-123-4567")`, `telHref("+972501234567")` all `"tel:+972501234567"`; `telHref("12")` and `telHref(null)` are `null`.
- An attempt started 9:59 ago is not in `due`, and `nextDueAt` is its start + 10 minutes.
- An attempt started exactly 10:00 ago is due.
- A documentation row for the same key with `createdAt >= startedAt` removes it; one with `createdAt < startedAt` does not.
- A dismissed attempt is neither due nor `nextDueAt`.
- An attempt started 7 days + 1 ms ago is ignored.
- Two open attempts for one lead give one reminder with the earlier `startedAt`.
- `due` is sorted oldest first; `nextDueAt` is the earliest future due time across targets, `null` when none.
- `openAttemptFor` returns the earliest open attempt for the target, `null` after documentation.

`validations.test.ts`:
- `callTargetSchema` accepts a lead UUID, rejects `"x"`; accepts retention `{ reportMonth: "2026-11-01", phone: "050-123-4567" }` and outputs phone `"+972501234567"`; rejects month `"2026-11-15"` and phone `"123"`.
- `retentionCallLogSchema` requires an outcome from the four lead outcomes and rejects notes over 2000 characters.

- [ ] **Step 2: Run** `npm run test:run -- src/features/call-reminders` — expected FAIL (modules missing).
- [ ] **Step 3: Implement** both modules. Keys and comparisons use epoch ms; return new arrays only.
- [ ] **Step 4: Run** the same command — expected PASS.
- [ ] **Step 5: Commit** `feat(calls): reminder rules and call target schemas`.

### Task 2: Migration, types and the shared retention scope

**Files:**
- Create: `supabase/migrations/20261106140000_call_reminders.sql`
- Create: `src/lib/retention/scope.ts` (`import "server-only"`)
- Modify: `src/lib/actions/admin-retention.ts:16-51` (import the two helpers instead of defining them)
- Modify: `src/types/database.generated.ts` (hand-matched until `npm run db:types`)

**Interfaces:**
- Produces: `callerVisiblePhones(): Promise<Set<string> | null | { error: string }>`, `assertPhoneInScope(phone: string): Promise<string | null>` from `@/lib/retention/scope`.
- Tables exactly as the spec's Data section: `call_attempts(id, caller_id, lead_id, report_month, trainee_phone, contact_name, started_at, dismissed_at)` with CHECKs (exactly one target; retention target has a month and an E.164 phone; lead target has neither), index `(caller_id, started_at)`, index `(lead_id)`; `retention_call_log(id, report_month, trainee_phone, trainee_name, author_id, outcome lead_contact_outcome NOT NULL, notes, created_at)` with index `(trainee_phone, created_at DESC)`; `lead_contact_log.author_id uuid REFERENCES profiles(id) ON DELETE SET NULL` plus index `(lead_id, author_id, created_at)`.

- [ ] **Step 1:** Write the migration (header: expand only, apply before deploy, safe to rerun; `SET LOCAL lock_timeout = '3s'`; `IF NOT EXISTS` everywhere; RLS on, revoke from anon and authenticated).
- [ ] **Step 2:** Move the helpers into `src/lib/retention/scope.ts`; `admin-retention.ts` imports them.
- [ ] **Step 3:** Add the three table shapes to `database.generated.ts` in alphabetical position.
- [ ] **Step 4: Run** `npx tsc --noEmit` and `npm run test:run` — expected clean and green.
- [ ] **Step 5: Commit** `feat(calls): call attempts and retention call log tables`.

### Task 3: Server actions

**Files:**
- Create: `src/features/call-reminders/lib/actions/call-attempts.ts` (`"use server"`)
- Create: `src/features/call-reminders/lib/actions/retention-call-log.ts` (`"use server"`)
- Create: `src/features/call-reminders/lib/queries.ts` (`import "server-only"`; loads a caller's attempts and documentation rows into the Task 1 shapes)
- Modify: `src/lib/actions/admin-leads-contact.ts:18-49` (insert `author_id: user!.id`)

**Interfaces:**
- Consumes: Task 1 rules and schemas; Task 2 scope helpers.
- Produces (all return `{ success: true; data } | { error: string }` with Hebrew errors):
  - `startCallAttemptAction(target: CallTarget, contactName: string): Promise<{ success: true; data: { attemptId: string; dueAt: string } } | { error: string }>` — lead: must exist, name taken from the lead row; retention: `assertPhoneInScope`; reuses `openAttemptFor` before inserting.
  - `getCallRemindersAction(): Promise<{ success: true; data: { due: readonly DueReminder[]; nextDueAt: string | null } } | { error: string }>`
  - `dismissCallReminderAction(attemptId: string): Promise<{ success: true } | { error: string }>` — sets `dismissed_at` on every open attempt of the caller with the same target as `attemptId`; refuses another caller's attempt.
  - `addRetentionCallLogAction(input: RetentionCallLogInput): Promise<{ success: true } | { error: string; fieldErrors?: Record<string, string[]> }>`
  - `getRetentionCallLogAction(phone: string): Promise<{ success: true; data: readonly RetentionCallEntry[] } | { error: string }>` with `RetentionCallEntry = { id; outcome; notes: string | null; authorName: string | null; createdAt: string; reportMonth: string }`, newest first, at most 50.

- [ ] **Step 1:** Implement `queries.ts` (window start = now - 7 days; documentation filtered by `author_id = caller` and `created_at >= window start`).
- [ ] **Step 2:** Implement the actions; validate every input with the Task 1 schemas and `isValidUUID`; log server errors with a `[calls]` prefix.
- [ ] **Step 3: Run** `npx tsc --noEmit`, `npm run lint` — expected clean.
- [ ] **Step 4: Commit** `feat(calls): call attempt and retention call log actions`.

### Task 4: Call link and the leads surfaces

**Files:**
- Create: `src/features/call-reminders/components/CallLink.tsx` (client)
- Create: `src/features/call-reminders/lib/events.ts` (`CALL_EVENTS = { started: "call-attempt-started", documented: "call-documented" }`, `emitCallEvent(name)`)
- Modify: `src/components/admin/leads/LeadTableColumns.tsx:64-70`, `src/components/admin/leads/LeadDataTable.tsx:176-215` (card becomes a `div` holding the existing button and the link side by side), `src/components/admin/leads/LeadDetailSheet.tsx:297-299`
- Modify: `src/components/admin/leads/LeadContactLogForm.tsx` (optional `defaultContactType?: LeadContactType`; emit `documented` after a successful save)

**Interfaces:**
- Produces: `<CallLink target={CallTarget} phone={string | null} contactName={string} className? />` — renders plain text when `telHref` is null; `onClick` stops propagation, fires `startCallAttemptAction` without awaiting the navigation, toasts "התזכורת לתיעוד השיחה לא נשמרה" on error, emits `started` on success. Accessible name: `התקשרות ל<name>`.

- [ ] **Step 1:** Build `CallLink` and `events.ts`.
- [ ] **Step 2:** Place it in the three lead surfaces; the row click must not open the sheet when the link is tapped.
- [ ] **Step 3: Run** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 4: Commit** `feat(leads): click-to-call on every lead phone`.

### Task 5: Retention call column and dialog

**Files:**
- Create: `src/features/call-reminders/components/RetentionCallDialog.tsx` (client; form + history)
- Modify: `src/components/admin/retention/RetentionTable.tsx` (new "שיחה" column after the name; needs `reportMonth` prop)
- Modify: `src/components/admin/retention/RetentionPageClient.tsx` (pass `selectedMonth`)

**Interfaces:**
- Consumes: Task 3 retention actions, Task 4 `CallLink` and events.
- Produces: `<RetentionCallDialog reportMonth={string} phone={string} traineeName={string} trigger?: ReactNode open? onOpenChange? />` — loads history on open, outcome select required, note optional, emits `documented` after save. Reused by the reminder card.

- [ ] **Step 1:** Build the dialog with react-hook-form + `retentionCallLogSchema` (required fields in the schema, defaults in `defaultValues`).
- [ ] **Step 2:** Add the column; rows without a normalizable phone show "—".
- [ ] **Step 3: Run** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 4: Commit** `feat(retention): call column and call log`.

### Task 6: Reminder watcher

**Files:**
- Create: `src/features/call-reminders/components/CallReminderWatcher.tsx` (client)
- Modify: `src/app/admin/layout.tsx` (render `<CallReminderWatcher />` inside `SidebarInset`)

**Interfaces:**
- Consumes: `getCallRemindersAction`, `dismissCallReminderAction`, `LeadContactLogForm` (`defaultContactType="call"`), `RetentionCallDialog`, `CALL_EVENTS`.
- Behavior: refresh on mount, every 60 s, on `visibilitychange` to visible, on `focus`, on both call events, and once at `nextDueAt` + 1 s; clear timers on unmount; ignore a refresh error silently after logging (the next one retries). Fixed card `inset-x-4 bottom-4 sm:max-w-sm sm:start-auto z-50`, `role="status"`, one row per reminder with name, "לא תיעדת את השיחה", relative time, "תיעוד" (dialog with the matching form), "לא התקיימה שיחה".

- [ ] **Step 1:** Build the watcher and the card.
- [ ] **Step 2:** Mount it in the admin layout.
- [ ] **Step 3: Run** `npx tsc --noEmit`, `npm run lint`, `npm run test:run`.
- [ ] **Step 4: Commit** `feat(calls): remind the trainer to document a call`.

### Task 7: Verify and ship

- [ ] **Step 1:** Full `npm run test:run`, `npx tsc --noEmit`, `npm run lint`; a code-reviewer pass over the branch.
- [ ] **Step 2:** Push the migration (with Itay's OK), `npm run db:types`, commit any diff.
- [ ] **Step 3:** Browser checks from the spec's Testing section on the PR preview or production after merge.
- [ ] **Step 4:** PR closing #164 with the deploy order.
