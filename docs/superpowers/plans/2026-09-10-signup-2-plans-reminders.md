# קריית אתא Signup, Plan 2 of 3: Plan Status, Trainee Dashboard, Reminders

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A trainee sees their plan, its sessions, and its end date on the dashboard; a parent gets WhatsApp reminders with a renewal link before and at expiry; renewal opens `/join` prefilled.

**Architecture:** One query helper joins `trainee_plans` to the roster rows and applies `resolvePlanStatus`, so every surface uses the same numbers. A daily cron expires stale orders and sends the due milestone reminder per plan. The renewal link carries a signed token that `/join` verifies to prefill and lock the product.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Supabase, Vercel cron, WhatsApp Cloud API templates, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-kiryat-ata-signup-design.md` (Section 3). Requires Plan 1 (`2026-09-10-signup-1-checkout.md`).

## Global Constraints

- Same as Plan 1: Hebrew copy, logical CSS, immutability, `verify*` gates, uuid validation, `typedFrom` for the new tables, no mock tests, 800-line max.
- Cron routes authenticate with `Authorization: Bearer ${CRON_SECRET}` and return 500 when the secret is unset, exactly as `src/app/api/cron/arbox-sync/route.ts`.
- "Today" is always `israelToday()` from `@/lib/utils/tasks`; never `new Date().toISOString()` for calendar logic.
- Commit format: `feat(plans): ...`, `test(plans): ...`.
- After every task: `npx tsc --noEmit` and `npm run lint` clean.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/features/plans/lib/queries.ts` | `loadPlansWithUsage`, `loadOwnPlanWithUsage` |
| `src/features/plans/lib/renewal-link.ts` | `buildRenewalUrl` |
| `src/features/plans/lib/actions/renewal-prefill.ts` | `loadRenewalPrefill` |
| `src/features/plans/components/MyPlanCard.tsx` | Dashboard card and expired banner |
| `src/features/plans/components/PlanStatusBadge.tsx` | Shared badge (also used by Plan 3) |
| `src/app/api/cron/plan-reminders/route.ts` | Daily reminders and order expiry |
| `src/features/plans/lib/reminders.ts` | `runPlanReminders` |
| `src/lib/plans/__tests__/reminder-copy.test.ts`, `src/lib/plans/reminder-copy.ts` | Hebrew reason text per milestone |

**Modified:**

| File | Change |
|---|---|
| `src/app/dashboard/page.tsx` | Render `MyPlanCard` |
| `src/app/join/page.tsx`, `src/features/enrollment/components/JoinPageClient.tsx` | Renewal prefill |
| `vercel.json` | New cron |

---

### Task 10: Plan queries and the trainee dashboard card

**Files:**
- Create: `src/features/plans/lib/queries.ts`, `src/features/plans/components/PlanStatusBadge.tsx`, `src/features/plans/components/MyPlanCard.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `resolvePlanStatus`, `countSessionsUsedFromRows`, `PLAN_STATUS_LABELS_HE`, `TraineePlan`, `PlanProduct`.
- Produces:
  - `interface PlanWithUsage { plan: TraineePlan; product: Pick<PlanProduct, "name_he" | "kind">; sessionsUsed: number; status: PlanStatus }`
  - `loadPlansWithUsage(db, profileIds: readonly string[], today: string): Promise<Map<string, PlanWithUsage>>` (the most relevant plan per profile: the active one ending last, else the most recently ended)
  - `loadOwnPlanWithUsage(today): Promise<PlanWithUsage | null>` for the signed-in trainee
  - `PlanStatusBadge({ status })`

- [ ] **Step 1: Queries**

`src/features/plans/lib/queries.ts`:

```ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { countSessionsUsedFromRows, resolvePlanStatus } from "@/lib/plans/plan-status";
import type { PlanProduct, PlanStatus, TraineePlan } from "@/types/plans";

export interface PlanWithUsage {
  plan: TraineePlan;
  product: Pick<PlanProduct, "name_he" | "kind">;
  sessionsUsed: number;
  status: PlanStatus;
}

type PlanRow = TraineePlan & { product: Pick<PlanProduct, "name_he" | "kind"> | null };

interface RosterRow {
  trainee_id: string;
  slot: { schedule_date: string; branch_id: string | null } | null;
}

/**
 * Roster rows for these trainees in one query. PostgREST embeds the slot so
 * the date and branch come along; the window filter is applied in memory per
 * plan because each plan has its own window.
 */
async function loadRosterRows(db: SupabaseClient, profileIds: readonly string[]): Promise<RosterRow[]> {
  if (profileIds.length === 0) return [];
  const { data, error } = (await typedFrom(db, "daily_schedule_slot_trainees")
    .select("trainee_id, slot:daily_schedule_slots!inner(schedule_date, branch_id)")
    .in("trainee_id", [...profileIds])) as { data: RosterRow[] | null; error: { message: string } | null };
  if (error) {
    console.error("loadRosterRows error:", error);
    return [];
  }
  return data ?? [];
}

/** Active first, then the one ending last: the plan that matters right now. */
function pickRelevant(plans: readonly PlanRow[]): PlanRow | null {
  const active = plans.filter((p) => p.status === "active");
  const pool = active.length > 0 ? active : plans;
  return [...pool].sort((a, b) => (a.ends_on < b.ends_on ? 1 : -1))[0] ?? null;
}

export function toPlanWithUsage(
  row: PlanRow,
  rosterRows: readonly RosterRow[],
  today: string,
): PlanWithUsage {
  const rows = rosterRows
    .filter((r) => r.trainee_id === row.profile_id && r.slot)
    .map((r) => ({ schedule_date: r.slot!.schedule_date, branch_id: r.slot!.branch_id }));
  const sessionsUsed = countSessionsUsedFromRows(rows, row, today);
  return {
    plan: row,
    product: row.product ?? { name_he: "מסלול", kind: "subscription" },
    sessionsUsed,
    status: resolvePlanStatus(row, sessionsUsed, today),
  };
}

/**
 * The plan to show for each profile, with its usage and derived status.
 * Callers pass the client that has the right to read: the user client for
 * the trainee's own row, the admin client for staff surfaces.
 */
export async function loadPlansWithUsage(
  db: SupabaseClient,
  profileIds: readonly string[],
  today: string,
): Promise<Map<string, PlanWithUsage>> {
  const result = new Map<string, PlanWithUsage>();
  if (profileIds.length === 0) return result;

  const { data, error } = (await typedFrom(db, "trainee_plans")
    .select("*, product:plan_products(name_he, kind)")
    .in("profile_id", [...profileIds])) as { data: PlanRow[] | null; error: { message: string } | null };
  if (error) {
    console.error("loadPlansWithUsage error:", error);
    return result;
  }

  const byProfile = new Map<string, PlanRow[]>();
  for (const row of data ?? []) {
    byProfile.set(row.profile_id, [...(byProfile.get(row.profile_id) ?? []), row]);
  }

  const rosterRows = await loadRosterRows(db, [...byProfile.keys()]);
  for (const [profileId, plans] of byProfile) {
    const relevant = pickRelevant(plans);
    if (relevant) result.set(profileId, toPlanWithUsage(relevant, rosterRows, today));
  }
  return result;
}

/** The signed-in trainee's own plan through RLS. Null when they have none. */
export async function loadOwnPlanWithUsage(today: string): Promise<PlanWithUsage | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const map = await loadPlansWithUsage(supabase, [user.id], today);
  return map.get(user.id) ?? null;
}
```

The trainee reads roster rows through RLS too: check that `daily_schedule_slot_trainees` and `daily_schedule_slots` have a SELECT policy that lets a trainee read their own roster rows (`grep -n "slot_trainees" -A6 supabase/migrations/20260806120000_daily_schedule.sql`). If they are staff-only, `loadOwnPlanWithUsage` must use `createAdminClient()` for the roster read only, after `auth.getUser()` has confirmed the caller; add that branch and say so in a comment.

- [ ] **Step 2: Badge and card**

`src/features/plans/components/PlanStatusBadge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLAN_STATUS_LABELS_HE, type PlanStatus } from "@/types/plans";

const STYLES: Record<PlanStatus, string> = {
  active: "bg-green-600 text-white hover:bg-green-600",
  ending_soon: "bg-amber-500 text-black hover:bg-amber-500",
  expired: "bg-destructive text-white hover:bg-destructive",
  cancelled: "bg-muted text-muted-foreground hover:bg-muted",
};

export function PlanStatusBadge({ status, className }: { status: PlanStatus; className?: string }) {
  return <Badge className={cn(STYLES[status], className)}>{PLAN_STATUS_LABELS_HE[status]}</Badge>;
}
```

`src/features/plans/components/MyPlanCard.tsx`:

```tsx
import Link from "next/link";
import { CalendarClock, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/utils/iso-date";
import type { PlanWithUsage } from "../lib/queries";
import { PlanStatusBadge } from "./PlanStatusBadge";

interface MyPlanCardProps {
  planWithUsage: PlanWithUsage;
  renewUrl: string;
}

/**
 * The trainee's plan at a glance. An expired plan turns the card into the
 * banner; nothing is blocked, the renewal button is the only change.
 */
export function MyPlanCard({ planWithUsage, renewUrl }: MyPlanCardProps) {
  const { plan, product, sessionsUsed, status } = planWithUsage;
  const expired = status === "expired";
  const sessionsLeft = plan.sessions_total === null ? null : Math.max(plan.sessions_total - sessionsUsed, 0);

  return (
    <Card className={cn(expired && "border-destructive/50 bg-destructive/5")}>
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">המסלול שלי</h3>
            <PlanStatusBadge status={status} />
          </div>
          <p className="font-medium">{product.name_he}</p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {sessionsLeft !== null && (
              <span className="flex items-center gap-1">
                <Ticket className="h-4 w-4" />
                {sessionsUsed} מתוך {plan.sessions_total} אימונים נוצלו
              </span>
            )}
            <span className="flex items-center gap-1">
              <CalendarClock className="h-4 w-4" />
              {expired ? "הסתיים ב-" : "בתוקף עד "}
              {shortDate(plan.ends_on)}
            </span>
          </div>
          {expired && (
            <p className="text-sm text-destructive">המסלול הסתיים. אפשר לחדש אותו בלחיצה.</p>
          )}
        </div>
        {status !== "cancelled" && (
          <Button asChild variant={expired || status === "ending_soon" ? "default" : "outline"}>
            <Link href={renewUrl}>{expired ? "חידוש המסלול" : "חידוש מוקדם"}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Renewal URL helper**

`src/features/plans/lib/renewal-link.ts`:

```ts
import "server-only";

import { RENEWAL_TOKEN_TTL_SECONDS, signRenewalToken } from "@/lib/plans/renewal-token";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.edengarden.co.il";

/** `/join?renew=<token>`: opens the form for this plan without a login. */
export function buildRenewalUrl(planId: string, nowUnix = Math.floor(Date.now() / 1000)): string {
  const secret = process.env.PLAN_RENEWAL_TOKEN_SECRET ?? "";
  const token = signRenewalToken(planId, nowUnix + RENEWAL_TOKEN_TTL_SECONDS, secret);
  return `${SITE_URL}/join?renew=${encodeURIComponent(token)}`;
}
```

- [ ] **Step 4: Dashboard**

In `src/app/dashboard/page.tsx`, add imports:

```ts
import { loadOwnPlanWithUsage } from "@/features/plans/lib/queries";
import { buildRenewalUrl } from "@/features/plans/lib/renewal-link";
import { MyPlanCard } from "@/features/plans/components/MyPlanCard";
```

After the existing `Promise.all` that loads `nextGame` and `ownClipWithUrl`, add:

```ts
  const ownPlan = await loadOwnPlanWithUsage(israelToday());
```

In the JSX, directly after `<PaymentStatusHandler />` (or as the first child of the page's main column if that component is placed elsewhere; find it with `grep -n PaymentStatusHandler src/app/dashboard/page.tsx`), render:

```tsx
        {ownPlan && (
          <MyPlanCard planWithUsage={ownPlan} renewUrl={buildRenewalUrl(ownPlan.plan.id)} />
        )}
```

Trainees without a plan (all of חיפה) see nothing new.

- [ ] **Step 5: Type-check, lint, look**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Sign in as the sandbox-created trainee (its login phone gets the OTP): the dashboard shows the card with the plan name, "0 מתוך N" for a card or only the end date for a monthly, and a green פעיל badge. Set `ends_on` to yesterday in SQL and reload: the card turns into the expired banner with a חידוש המסלול button whose link starts with `/join?renew=`.

- [ ] **Step 6: Commit**

```bash
git add src/features/plans src/app/dashboard/page.tsx
git commit -m "feat(plans): plan status on the trainee dashboard

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Renewal prefill on `/join`

**Files:**
- Create: `src/features/plans/lib/actions/renewal-prefill.ts`
- Modify: `src/app/join/page.tsx`, `src/features/enrollment/components/JoinPageClient.tsx`

**Interfaces:**
- Produces: `loadRenewalPrefill(token): Promise<{ productId: string; prefill: Partial<EnrollmentInput> } | null>`.

- [ ] **Step 1: Prefill loader**

`src/features/plans/lib/actions/renewal-prefill.ts`:

```ts
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyRenewalToken } from "@/lib/plans/renewal-token";
import type { EnrollmentInput } from "@/lib/validations/enrollment";
import type { EnrollmentAgreement, TraineePlan } from "@/types/plans";

export interface RenewalPrefill {
  productId: string;
  planId: string;
  prefill: Partial<EnrollmentInput>;
}

function localPhone(e164: string): string {
  return e164.startsWith("+972") ? `0${e164.slice(4)}` : e164;
}

/**
 * A valid token opens the form for the same product with the last agreement's
 * details filled in. The declarations and the signature are never prefilled:
 * the agreement is per purchase.
 */
export async function loadRenewalPrefill(token: string): Promise<RenewalPrefill | null> {
  const secret = process.env.PLAN_RENEWAL_TOKEN_SECRET ?? "";
  const verified = verifyRenewalToken(token, secret, Math.floor(Date.now() / 1000));
  if (!verified) return null;

  const db = createAdminClient();
  const { data: plan } = (await typedFrom(db, "trainee_plans")
    .select("id, product_id, profile_id, order_id")
    .eq("id", verified.planId)
    .maybeSingle()) as { data: Pick<TraineePlan, "id" | "product_id" | "profile_id" | "order_id"> | null };
  if (!plan) return null;

  const { data: agreement } = (await typedFrom(db, "enrollment_agreements")
    .select("*")
    .eq("profile_id", plan.profile_id)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: EnrollmentAgreement | null };

  const { data: profile } = await db
    .from("profiles")
    .select("phone, full_name, birthdate, guardian_name, guardian_phone")
    .eq("id", plan.profile_id)
    .maybeSingle();

  const prefill: Partial<EnrollmentInput> = {
    parentName: agreement?.parent_name ?? profile?.guardian_name ?? "",
    parentIdNumber: agreement?.parent_id_number ?? "",
    payerPhone: localPhone(agreement?.parent_phone ?? profile?.guardian_phone ?? ""),
    loginPhone: localPhone(profile?.phone ?? ""),
    email: agreement?.parent_email ?? "",
    childName: agreement?.child_name ?? profile?.full_name ?? "",
    childBirthdate: agreement?.child_birthdate ?? profile?.birthdate ?? "",
    medicalNotes: agreement?.medical_notes ?? "",
    emergencyContactName: agreement?.emergency_contact_name ?? "",
    emergencyContactPhone: localPhone(agreement?.emergency_contact_phone ?? ""),
  };

  return { productId: plan.product_id, planId: plan.id, prefill };
}
```

- [ ] **Step 2: Page wiring**

In `src/app/join/page.tsx`, import `loadRenewalPrefill` and, after loading the products:

```ts
  const renewal = params.renew ? await loadRenewalPrefill(params.renew) : null;
```

Pass to the client:

```tsx
      <JoinPageClient
        products={products}
        initialProductId={renewal?.productId ?? params.product ?? null}
        renewalToken={renewal ? params.renew! : null}
        prefill={renewal?.prefill}
      />
```

An invalid token falls through to a normal, unprefilled page. In `JoinPageClient.tsx` the catalog is already hidden when `renewalToken` is set; also render a line above the form:

```tsx
      {renewalToken && selected && (
        <p className="rounded-2xl border bg-white p-4 text-sm text-black/70">
          חידוש המסלול <span className="font-bold">{selected.name_he}</span>. הפרטים מולאו מההרשמה הקודמת; יש לאשר את ההצהרות ולחתום שוב.
        </p>
      )}
```

- [ ] **Step 3: Type-check, lint, check**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. Open the חידוש link from the dashboard: the catalog is hidden, the form shows the same product with parent, child, phones, and emergency contact filled, declarations unticked, signature empty. Submitting and paying in the sandbox creates a plan whose `starts_on` is the day after the old `ends_on` when the old plan is still running.

- [ ] **Step 4: Commit**

```bash
git add src/features/plans/lib/actions/renewal-prefill.ts src/app/join/page.tsx src/features/enrollment/components/JoinPageClient.tsx
git commit -m "feat(plans): renewal links prefill the enrollment form

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Reminder cron and order expiry

**Files:**
- Create: `src/lib/plans/reminder-copy.ts`, test `src/lib/plans/__tests__/reminder-copy.test.ts`
- Create: `src/features/plans/lib/reminders.ts`
- Create: `src/app/api/cron/plan-reminders/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `dueReminderMilestone`, `toPlanWithUsage`-style usage via `loadPlansWithUsage`, `sendPlanReminder`, `buildRenewalUrl`.
- Produces: `reminderReason(milestone): string`, `runPlanReminders(today): Promise<{ expiredOrders: number; reminded: number; failed: number }>`.

- [ ] **Step 1: Failing test**

`src/lib/plans/__tests__/reminder-copy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { reminderReason, REMINDED_COLUMN } from "../reminder-copy";

describe("reminder copy", () => {
  it("has Hebrew text and a stamp column per milestone", () => {
    expect(reminderReason("three_days")).toBe("מסתיים בעוד 3 ימים");
    expect(reminderReason("last_session")).toBe("נותר אימון אחד");
    expect(reminderReason("expired")).toBe("הסתיים");
    expect(REMINDED_COLUMN.three_days).toBe("reminded_3_days_at");
    expect(REMINDED_COLUMN.last_session).toBe("reminded_last_session_at");
    expect(REMINDED_COLUMN.expired).toBe("reminded_expired_at");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:run -- src/lib/plans/__tests__/reminder-copy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Copy module**

`src/lib/plans/reminder-copy.ts`:

```ts
import type { ReminderMilestone } from "./plan-status";

export const REMINDED_COLUMN: Record<
  ReminderMilestone,
  "reminded_3_days_at" | "reminded_last_session_at" | "reminded_expired_at"
> = {
  three_days: "reminded_3_days_at",
  last_session: "reminded_last_session_at",
  expired: "reminded_expired_at",
};

/** The {{4}} parameter of the reminder template. */
export function reminderReason(milestone: ReminderMilestone): string {
  switch (milestone) {
    case "three_days":
      return "מסתיים בעוד 3 ימים";
    case "last_session":
      return "נותר אימון אחד";
    case "expired":
      return "הסתיים";
  }
}
```

- [ ] **Step 4: Reminder runner**

`src/features/plans/lib/reminders.ts`:

```ts
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { dueReminderMilestone } from "@/lib/plans/plan-status";
import { REMINDED_COLUMN, reminderReason } from "@/lib/plans/reminder-copy";
import { sendPlanReminder } from "@/lib/whatsapp/plan-templates";
import type { TraineePlan } from "@/types/plans";
import { loadPlansWithUsage } from "./queries";
import { buildRenewalUrl } from "./renewal-link";

export interface ReminderRunResult {
  expiredOrders: number;
  reminded: number;
  failed: number;
}

const PENDING_ORDER_TTL_HOURS = 24;

/** Orders nobody paid within a day stop pretending to be open checkouts. */
async function expireStaleOrders(db: ReturnType<typeof createAdminClient>): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_ORDER_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await typedFrom(db, "orders")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    console.error("[plan-reminders] expire orders failed:", error);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * One reminder per plan per milestone, to the guardian phone. Every active
 * plan is evaluated: the ones with nothing due are skipped by
 * dueReminderMilestone, which also refuses to repeat a sent milestone.
 */
export async function runPlanReminders(today: string): Promise<ReminderRunResult> {
  const db = createAdminClient();
  const result: ReminderRunResult = { expiredOrders: 0, reminded: 0, failed: 0 };

  result.expiredOrders = await expireStaleOrders(db);

  const { data: activePlans, error } = (await typedFrom(db, "trainee_plans")
    .select("profile_id")
    .eq("status", "active")) as { data: Pick<TraineePlan, "profile_id">[] | null; error: { message: string } | null };
  if (error) {
    console.error("[plan-reminders] load plans failed:", error);
    return result;
  }

  const profileIds = Array.from(new Set((activePlans ?? []).map((p) => p.profile_id)));
  const plans = await loadPlansWithUsage(db, profileIds, today);

  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, guardian_name, guardian_phone")
    .in("id", profileIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  for (const [profileId, { plan, product, sessionsUsed }] of plans) {
    const milestone = dueReminderMilestone(plan, sessionsUsed, today);
    if (!milestone) continue;

    const profile = profileById.get(profileId);
    if (!profile?.guardian_phone) continue;

    const sent = await sendPlanReminder(profile.guardian_phone, {
      parentName: profile.guardian_name ?? "הורה יקר",
      childName: profile.full_name ?? "החניך",
      planName: product.name_he,
      reason: reminderReason(milestone),
      renewUrl: buildRenewalUrl(plan.id),
    });

    if (!sent.success) {
      console.error(`[plan-reminders] send failed for plan ${plan.id}:`, sent.error);
      result.failed += 1;
      continue;
    }

    await typedFrom(db, "trainee_plans")
      .update({ [REMINDED_COLUMN[milestone]]: new Date().toISOString() })
      .eq("id", plan.id);
    result.reminded += 1;
  }

  return result;
}
```

- [ ] **Step 5: Cron route and schedule**

`src/app/api/cron/plan-reminders/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { runPlanReminders } from "@/features/plans/lib/reminders";
import { israelToday } from "@/lib/utils/tasks";

export const maxDuration = 120;

/** Daily at 07:00 Israel time (04:00 UTC): expire stale orders, send reminders. */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[plan-reminders] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPlanReminders(israelToday());
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[plan-reminders] fatal:", error);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
```

Add to `vercel.json` `crons`:

```json
    {
      "path": "/api/cron/plan-reminders",
      "schedule": "0 4 * * *"
    }
```

- [ ] **Step 6: Tests, type-check, lint, dry run**

Run: `npm run test:run -- src/lib/plans && npx tsc --noEmit && npm run lint`
Expected: PASS and clean.

Dry run against the dev server with the sandbox plan's `ends_on` set to two days from now:

```bash
curl -s -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '"')" http://localhost:3000/api/cron/plan-reminders
```

Expected: `{"success":true,"expiredOrders":N,"reminded":1,"failed":0}` when the template exists, or `"failed":1` with a logged template error when Meta has not approved it yet; either way `reminded_3_days_at` is set only on success, and a second call reports `reminded: 0`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/plans/reminder-copy.ts src/lib/plans/__tests__/reminder-copy.test.ts src/features/plans/lib/reminders.ts src/app/api/cron/plan-reminders/route.ts vercel.json
git commit -m "feat(plans): daily reminders with renewal links and stale order expiry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Plan 2 wrap-up

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`
Expected: clean, baseline failures only, build compiles.

- [ ] **Step 2: CLAUDE.md**

Under the "קריית אתא signup" architecture note, append:

```markdown
Reminders: `/api/cron/plan-reminders` runs daily; `dueReminderMilestone()` decides what is due and the `reminded_*_at` columns stop repeats. Renewal links are `/join?renew=<token>` signed with `PLAN_RENEWAL_TOKEN_SECRET`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(plans): reminder cron and renewal links

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Then continue with `docs/superpowers/plans/2026-09-10-signup-3-staff.md`.
