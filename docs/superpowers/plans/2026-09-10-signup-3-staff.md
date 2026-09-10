# קריית אתא Signup, Plan 3 of 3: Admin, Trainer, and Safety Surfaces

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eden manages plans, products, and orders in the admin; trainers see plan status, medical notes, and the emergency contact on the roster and the trainee page; the safety protocol lives in the app.

**Architecture:** Server actions under `src/features/plans/lib/actions/` gate on `verifyAdmin` (plans, products, orders, manual grants) or `verifyAdminOrTrainer` with the branch scope (health edits). Manual grants build a synthetic paid order and reuse `fulfillFromInput`, so a cash trainee gets the same account path. Roster and user-list badges read `loadPlansWithUsage` through the service role. The safety page renders the typed content from Plan 1.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-kiryat-ata-signup-design.md` (Section 4 and the agreement and protocol parts of Sections 1 and 2). Requires Plans 1 and 2.

## Global Constraints

- Same as Plans 1 and 2. Trainer-facing reads of other users' plans and health fields go through `createAdminClient()` inside actions gated by `verifyAdminOrTrainer()` plus `isTraineeInScope`.
- Commit format: `feat(plans): ...`, `feat(safety): ...`.
- After every task: `npx tsc --noEmit` and `npm run lint` clean.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/lib/validations/plans-admin.ts` | Zod for extend, add sessions, manual grant, product edit, health edit |
| `src/features/plans/lib/actions/admin-plans.ts` | list, extend, add sessions, cancel, grant |
| `src/features/plans/lib/actions/admin-products.ts` | catalog CMS actions |
| `src/features/plans/lib/actions/admin-orders.ts` | list, retry fulfillment, unassigned events |
| `src/features/plans/lib/actions/trainee-health.ts` | read and update health fields (staff, scoped) |
| `src/features/plans/lib/actions/staff-plan-badges.ts` | `loadPlanStatusesForStaff` |
| `src/features/plans/components/admin/PlansTable.tsx`, `PlanActionsDialog.tsx`, `ManualGrantDialog.tsx`, `ProductsClient.tsx`, `OrdersTable.tsx` | Admin islands |
| `src/features/plans/components/UserPlanCard.tsx`, `HealthCard.tsx` | User detail cards |
| `src/features/plans/components/HealthSheet.tsx` | Roster chip health sheet |
| `src/app/admin/plans/page.tsx`, `src/app/admin/plans/products/page.tsx`, `src/app/admin/orders/page.tsx`, `src/app/admin/safety/page.tsx` | Pages |
| `src/features/safety/components/SafetyProtocol.tsx` | Protocol rendering |

**Modified:**

| File | Change |
|---|---|
| `src/lib/navigation/admin-nav.ts` | Four entries |
| `src/app/admin/users/[userId]/page.tsx` | Plan and health cards |
| `src/components/admin/users/UserTableColumns.tsx`, `UserDataTable.tsx`, `src/app/admin/users/page.tsx` | Plan status column |
| `src/components/admin/schedule/SlotCard.tsx`, `ScheduleDayView.tsx`, `week/WeekDayColumn.tsx`, `src/app/admin/schedule/page.tsx`, `src/app/admin/weekly-schedule/page.tsx` | Roster badges and health icon, safety link |
| `src/features/branches/components/admin/BranchesClient.tsx`, `src/features/branches/lib/actions/admin-branches.ts`, `src/lib/validations/branch.ts` | `manager_phone` |

---

### Task 14: Admin plans list and actions

**Files:**
- Create: `src/lib/validations/plans-admin.ts`, `src/features/plans/lib/actions/admin-plans.ts`, `src/features/plans/components/admin/PlansTable.tsx`, `PlanActionsDialog.tsx`, `ManualGrantDialog.tsx`, `src/app/admin/plans/page.tsx`
- Modify: `src/lib/navigation/admin-nav.ts`

**Interfaces:**
- Consumes: `loadPlansWithUsage`, `PlanStatusBadge`, `fulfillFromInput`, `enrollmentSchema` pieces, `BranchUrlFilter`, `listActiveBranchOptionsAction`.
- Produces:
  - `listPlansAction(filter: { branchId?: string; status?: PlanStatus }): Promise<AdminPlanRow[]>` where `AdminPlanRow = PlanWithUsage & { traineeName: string; guardianName: string | null; guardianPhone: string | null; orderDocumentUrl: string | null }`
  - `extendPlanAction({ planId, endsOn })`, `addSessionsAction({ planId, sessions })`, `cancelPlanAction({ planId })`, `grantPlanAction(input: ManualGrantInput)` each returning `{ success: true } | { error: string }`

- [ ] **Step 1: Schemas**

`src/lib/validations/plans-admin.ts`:

```ts
import { z } from "zod";
import {
  PHONE_REGEX_IL,
  UUID_REGEX,
  formatPhoneToInternational,
  isValidDateString,
} from "@/lib/validations/common";

const uuid = z.string().regex(UUID_REGEX, "מזהה לא תקין");
const isoDate = z.string().refine(isValidDateString, "תאריך לא תקין");
const phone = z.string().trim().regex(PHONE_REGEX_IL, "מספר טלפון לא תקין").transform(formatPhoneToInternational);

export const extendPlanSchema = z.object({ planId: uuid, endsOn: isoDate });
export const addSessionsSchema = z.object({
  planId: uuid,
  sessions: z.number().int().min(1, "לפחות אימון אחד").max(50, "יותר מדי אימונים"),
});
export const cancelPlanSchema = z.object({ planId: uuid });

/** A cash or bank-transfer trainee, entered by Eden. Same fields as the public form minus the declarations. */
export const manualGrantSchema = z.object({
  productId: uuid,
  parentName: z.string().trim().min(2, "נדרש שם ההורה").max(100),
  payerPhone: phone,
  loginPhone: phone,
  childName: z.string().trim().min(2, "נדרש שם החניך").max(100),
  childBirthdate: isoDate,
  email: z.string().trim().email("כתובת דוא\"ל לא תקינה").or(z.literal("")).transform((v) => (v === "" ? null : v)),
  emergencyContactName: z.string().trim().max(100).transform((v) => (v === "" ? null : v)),
  emergencyContactPhone: z.string().trim().regex(PHONE_REGEX_IL, "מספר טלפון לא תקין").or(z.literal("")).transform((v) => (v === "" ? null : formatPhoneToInternational(v))),
  medicalNotes: z.string().trim().max(500).transform((v) => (v === "" ? null : v)),
  paymentMethod: z.enum(["cash", "transfer", "other"]),
  note: z.string().trim().max(200).transform((v) => (v === "" ? null : v)),
  startsOn: isoDate,
});
export type ManualGrantInput = z.input<typeof manualGrantSchema>;

export const productSchema = z.object({
  name_he: z.string().trim().min(1, "נדרש שם").max(80),
  blurb_he: z.string().trim().max(200).transform((v) => (v === "" ? null : v)),
  price_ils: z.number().positive("מחיר חייב להיות חיובי").max(100000),
  sessions_total: z.number().int().positive().nullable(),
  duration_days: z.number().int().positive("נדרש משך בימים").max(730),
  once_per_trainee: z.boolean(),
  gift_he: z.string().trim().max(200).transform((v) => (v === "" ? null : v)),
  is_active: z.boolean(),
});
export type ProductInput = z.input<typeof productSchema>;

export const healthSchema = z.object({
  traineeId: uuid,
  medicalNotes: z.string().trim().max(500).transform((v) => (v === "" ? null : v)),
  emergencyContactName: z.string().trim().max(100).transform((v) => (v === "" ? null : v)),
  emergencyContactPhone: z.string().trim().regex(PHONE_REGEX_IL, "מספר טלפון לא תקין").or(z.literal("")).transform((v) => (v === "" ? null : formatPhoneToInternational(v))),
});
export type HealthInput = z.input<typeof healthSchema>;

export const PAYMENT_METHOD_LABELS_HE = {
  cash: "מזומן",
  transfer: "העברה בנקאית",
  other: "אחר",
} as const;
```

- [ ] **Step 2: Actions**

`src/features/plans/lib/actions/admin-plans.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { israelToday } from "@/lib/utils/tasks";
import { addDays } from "@/lib/utils/iso-date";
import { isValidUUID } from "@/lib/validations/common";
import {
  addSessionsSchema,
  cancelPlanSchema,
  extendPlanSchema,
  manualGrantSchema,
  PAYMENT_METHOD_LABELS_HE,
  type ManualGrantInput,
} from "@/lib/validations/plans-admin";
import { fulfillFromInput } from "@/features/enrollment/lib/fulfillment";
import { notifyOrderFulfilled } from "@/features/enrollment/lib/notify";
import type { Order, PlanProduct, PlanStatus } from "@/types/plans";
import { loadPlansWithUsage, type PlanWithUsage } from "../queries";

type ActionResult = { success: true } | { error: string };

export type AdminPlanRow = PlanWithUsage & {
  traineeName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  orderDocumentUrl: string | null;
};

function revalidatePlanSurfaces(profileId?: string): void {
  revalidatePath("/admin/plans");
  revalidatePath("/admin/users");
  if (profileId) revalidatePath(`/admin/users/${profileId}`);
}

/** Every plan in one branch (or all), newest ending first. */
export async function listPlansAction(filter: {
  branchId?: string;
  status?: PlanStatus;
}): Promise<AdminPlanRow[]> {
  const { error } = await verifyAdmin();
  if (error) return [];

  const db = createAdminClient();
  let query = typedFrom(db, "trainee_plans").select("profile_id, branch_id");
  if (filter.branchId && isValidUUID(filter.branchId)) {
    query = query.eq("branch_id", filter.branchId);
  }
  const { data: rows } = (await query) as { data: { profile_id: string }[] | null };
  const profileIds = Array.from(new Set((rows ?? []).map((r) => r.profile_id)));

  const [plans, { data: profiles }] = await Promise.all([
    loadPlansWithUsage(db, profileIds, israelToday()),
    db.from("profiles").select("id, full_name, guardian_name, guardian_phone").in("id", profileIds),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const orderIds = [...plans.values()].map((p) => p.plan.order_id).filter((id): id is string => id !== null);
  const { data: orders } = (orderIds.length
    ? await typedFrom(db, "orders").select("id, morning_document_url").in("id", orderIds)
    : { data: [] }) as { data: Pick<Order, "id" | "morning_document_url">[] | null };
  const docByOrder = new Map((orders ?? []).map((o) => [o.id, o.morning_document_url]));

  return [...plans.entries()]
    .map(([profileId, withUsage]) => {
      const profile = profileById.get(profileId);
      return {
        ...withUsage,
        traineeName: profile?.full_name ?? "ללא שם",
        guardianName: profile?.guardian_name ?? null,
        guardianPhone: profile?.guardian_phone ?? null,
        orderDocumentUrl: withUsage.plan.order_id ? (docByOrder.get(withUsage.plan.order_id) ?? null) : null,
      };
    })
    .filter((row) => !filter.status || row.status === filter.status)
    .sort((a, b) => (a.plan.ends_on < b.plan.ends_on ? 1 : -1));
}

export async function extendPlanAction(input: { planId: string; endsOn: string }): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  const parsed = extendPlanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  const db = createAdminClient();
  const { data, error } = await typedFrom(db, "trainee_plans")
    .update({ ends_on: parsed.data.endsOn })
    .eq("id", parsed.data.planId)
    .select("profile_id");
  if (error || !data?.length) return { error: "המסלול לא נמצא" };
  revalidatePlanSurfaces(data[0].profile_id);
  return { success: true };
}

export async function addSessionsAction(input: { planId: string; sessions: number }): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  const parsed = addSessionsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  const db = createAdminClient();
  const { data: plan } = (await typedFrom(db, "trainee_plans")
    .select("profile_id, sessions_total")
    .eq("id", parsed.data.planId)
    .maybeSingle()) as { data: { profile_id: string; sessions_total: number | null } | null };
  if (!plan) return { error: "המסלול לא נמצא" };
  if (plan.sessions_total === null) return { error: "למסלול לפי זמן אין מונה אימונים" };

  const { error } = await typedFrom(db, "trainee_plans")
    .update({ sessions_total: plan.sessions_total + parsed.data.sessions })
    .eq("id", parsed.data.planId);
  if (error) return { error: "שגיאה בעדכון המסלול" };
  revalidatePlanSurfaces(plan.profile_id);
  return { success: true };
}

export async function cancelPlanAction(input: { planId: string }): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  const parsed = cancelPlanSchema.safeParse(input);
  if (!parsed.success) return { error: "מזהה לא תקין" };

  const db = createAdminClient();
  const { data, error } = await typedFrom(db, "trainee_plans")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.planId)
    .select("profile_id");
  if (error || !data?.length) return { error: "המסלול לא נמצא" };
  revalidatePlanSurfaces(data[0].profile_id);
  return { success: true };
}

/**
 * A plan for someone who paid in cash or by transfer. Builds a paid order
 * with source manual and runs the same fulfillment as an online payment, so
 * the account, branch link, and confirmation are identical.
 */
export async function grantPlanAction(input: ManualGrantInput): Promise<ActionResult> {
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };
  const parsed = manualGrantSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const data = parsed.data;

  const db = createAdminClient();
  const { data: product } = (await typedFrom(db, "plan_products")
    .select("*")
    .eq("id", data.productId)
    .maybeSingle()) as { data: PlanProduct | null };
  if (!product) return { error: "המסלול לא נמצא" };

  const { data: order, error: orderError } = (await typedFrom(db, "orders")
    .insert({
      product_id: product.id,
      branch_id: product.branch_id,
      status: "paid",
      paid_at: new Date().toISOString(),
      amount_ils: product.price_ils,
      parent_name: data.parentName,
      payer_phone: data.payerPhone,
      login_phone: data.loginPhone,
      child_name: data.childName,
      child_birthdate: data.childBirthdate,
      email: data.email,
    })
    .select("*")
    .single()) as { data: Order | null; error: { message: string } | null };
  if (orderError || !order) return { error: "שגיאה ביצירת ההזמנה" };

  const { data: agreement } = (await typedFrom(db, "enrollment_agreements")
    .insert({
      order_id: order.id,
      agreement_version: "manual",
      parent_name: data.parentName,
      parent_id_number: "",
      parent_phone: data.payerPhone,
      parent_email: data.email,
      child_name: data.childName,
      child_birthdate: data.childBirthdate,
      medical_notes: data.medicalNotes,
      plan_name: product.name_he,
      plan_price_ils: product.price_ils,
      plan_start_on: data.startsOn,
      payment_method: PAYMENT_METHOD_LABELS_HE[data.paymentMethod],
      emergency_contact_name: data.emergencyContactName ?? "",
      emergency_contact_phone: data.emergencyContactPhone ?? "",
      declares_healthy: true,
      accepts_terms: true,
      authorizes_payment: true,
      photo_consent: false,
      signature_name: `${adminProfile?.full_name ?? "מנהל"} (הרשמה ידנית)`,
    })
    .select("*")
    .single()) as { data: import("@/types/plans").EnrollmentAgreement | null };

  const result = await fulfillFromInput(db, {
    order: { ...order, amount_ils: Number(order.amount_ils) },
    product: { ...product, price_ils: Number(product.price_ils) },
    agreement,
    createdBy: user!.id,
  });
  if (!result.ok) return { error: `ההזמנה נשמרה אך היצירה נכשלה: ${result.error}` };

  // A manual start date other than today: fix the window after fulfillment.
  if (data.startsOn !== israelToday()) {
    await typedFrom(db, "trainee_plans")
      .update({ starts_on: data.startsOn, ends_on: addDays(data.startsOn, product.duration_days - 1), note: data.note })
      .eq("id", result.planId);
  } else if (data.note) {
    await typedFrom(db, "trainee_plans").update({ note: data.note }).eq("id", result.planId);
  }

  await notifyOrderFulfilled(db, order.id);
  revalidatePlanSurfaces(result.profileId);
  return { success: true };
}
```

The agreement row for a manual grant records who entered it and the payment method; its `parent_id_number` is empty because Eden has the paper form. Manual grants do not check `once_per_trainee`: Eden decides.

- [ ] **Step 3: Table and dialogs**

`src/features/plans/components/admin/PlansTable.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { shortDate } from "@/lib/utils/iso-date";
import type { AdminPlanRow } from "../../lib/actions/admin-plans";
import { PlanStatusBadge } from "../PlanStatusBadge";
import { PlanActionsDialog } from "./PlanActionsDialog";

export function PlansTable({ rows }: { rows: AdminPlanRow[] }) {
  const [target, setTarget] = useState<AdminPlanRow | null>(null);

  if (rows.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">אין מסלולים להצגה</p>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">חניך</TableHead>
              <TableHead className="text-right">מסלול</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="text-right">אימונים</TableHead>
              <TableHead className="text-right">תוקף</TableHead>
              <TableHead className="text-right">מקור</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.plan.id}>
                <TableCell>
                  <Link href={`/admin/users/${row.plan.profile_id}`} className="font-medium hover:underline">
                    {row.traineeName}
                  </Link>
                  {row.guardianName && (
                    <div className="text-xs text-muted-foreground">
                      {row.guardianName} {row.guardianPhone ? `· ${row.guardianPhone}` : ""}
                    </div>
                  )}
                </TableCell>
                <TableCell>{row.product.name_he}</TableCell>
                <TableCell><PlanStatusBadge status={row.status} /></TableCell>
                <TableCell>
                  {row.plan.sessions_total === null ? "לפי זמן" : `${row.sessionsUsed} / ${row.plan.sessions_total}`}
                </TableCell>
                <TableCell>{shortDate(row.plan.starts_on)} עד {shortDate(row.plan.ends_on)}</TableCell>
                <TableCell>
                  {row.plan.source === "manual" ? `ידני${row.plan.note ? ` (${row.plan.note})` : ""}` : "אונליין"}
                  {row.orderDocumentUrl && (
                    <a href={row.orderDocumentUrl} target="_blank" rel="noreferrer" className="ms-2 inline-flex align-middle" aria-label="חשבונית">
                      <FileText className="h-4 w-4" />
                    </a>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => setTarget(row)} aria-label="פעולות">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {target && (
        <PlanActionsDialog key={target.plan.id} row={target} onClose={() => setTarget(null)} />
      )}
    </>
  );
}
```

`src/features/plans/components/admin/PlanActionsDialog.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addSessionsAction,
  cancelPlanAction,
  extendPlanAction,
  type AdminPlanRow,
} from "../../lib/actions/admin-plans";

export function PlanActionsDialog({ row, onClose }: { row: AdminPlanRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [endsOn, setEndsOn] = useState(row.plan.ends_on);
  const [sessions, setSessions] = useState(1);

  const run = (fn: () => Promise<{ success: true } | { error: string }>, done: string) => {
    startTransition(async () => {
      const result = await fn();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(done);
      router.refresh();
      onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{row.traineeName}: {row.product.name_he}</DialogTitle>
          <DialogDescription>הארכה, הוספת אימונים או ביטול המסלול</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label htmlFor="ends-on">תוקף עד</Label>
            <div className="flex gap-2">
              <Input id="ends-on" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} disabled={pending} />
              <Button onClick={() => run(() => extendPlanAction({ planId: row.plan.id, endsOn }), "התוקף עודכן")} disabled={pending}>
                שמירה
              </Button>
            </div>
          </div>

          {row.plan.sessions_total !== null && (
            <div className="space-y-2">
              <Label htmlFor="sessions">הוספת אימונים</Label>
              <div className="flex gap-2">
                <Input id="sessions" type="number" min={1} max={50} value={sessions} onChange={(e) => setSessions(Number(e.target.value))} disabled={pending} />
                <Button onClick={() => run(() => addSessionsAction({ planId: row.plan.id, sessions }), "האימונים נוספו")} disabled={pending}>
                  הוספה
                </Button>
              </div>
            </div>
          )}

          {row.plan.status === "active" && (
            <Button
              variant="destructive"
              className="w-full"
              disabled={pending}
              onClick={() => run(() => cancelPlanAction({ planId: row.plan.id }), "המסלול בוטל")}
            >
              {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              ביטול המסלול
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

`src/features/plans/components/admin/ManualGrantDialog.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { grantPlanAction } from "../../lib/actions/admin-plans";
import { PAYMENT_METHOD_LABELS_HE, type ManualGrantInput } from "@/lib/validations/plans-admin";
import type { PlanProduct } from "@/types/plans";

const EMPTY: ManualGrantInput = {
  productId: "",
  parentName: "",
  payerPhone: "",
  loginPhone: "",
  childName: "",
  childBirthdate: "",
  email: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  medicalNotes: "",
  paymentMethod: "cash",
  note: "",
  startsOn: new Date().toISOString().slice(0, 10),
};

export function ManualGrantDialog({ products }: { products: PlanProduct[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ManualGrantInput>(EMPTY);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof ManualGrantInput>(key: K, value: ManualGrantInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    startTransition(async () => {
      const result = await grantPlanAction(form);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("המסלול נוצר והחניך קיבל חשבון");
      setForm(EMPTY);
      setOpen(false);
      router.refresh();
    });
  };

  const field = (key: keyof ManualGrantInput, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`grant-${key}`}>{label}</Label>
      <Input id={`grant-${key}`} value={String(form[key] ?? "")} onChange={(e) => set(key, e.target.value as never)} disabled={pending} {...props} />
    </div>
  );

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 ms-2" />
        הרשמה ידנית
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>הרשמה ידנית (מזומן / העברה)</DialogTitle>
            <DialogDescription>יוצר חשבון, שיוך לסניף ומסלול, בדיוק כמו רכישה באתר.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>מסלול</Label>
              <Select value={form.productId} onValueChange={(v) => set("productId", v)} disabled={pending}>
                <SelectTrigger><SelectValue placeholder="בחר מסלול" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name_he} (₪{p.price_ils})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("parentName", "שם ההורה")}
            {field("payerPhone", "טלפון ההורה", { dir: "ltr", className: "text-right" })}
            {field("childName", "שם החניך")}
            {field("childBirthdate", "תאריך לידה", { type: "date" })}
            {field("loginPhone", "טלפון וואטסאפ להתחברות", { dir: "ltr", className: "text-right" })}
            {field("email", "דוא\"ל", { type: "email", dir: "ltr", className: "text-right" })}
            {field("emergencyContactName", "איש קשר לחירום")}
            {field("emergencyContactPhone", "טלפון לחירום", { dir: "ltr", className: "text-right" })}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="grant-medical">מגבלות רפואיות</Label>
              <Textarea id="grant-medical" rows={2} value={form.medicalNotes ?? ""} onChange={(e) => set("medicalNotes", e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label>אמצעי תשלום</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => set("paymentMethod", v as ManualGrantInput["paymentMethod"])} disabled={pending}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYMENT_METHOD_LABELS_HE) as (keyof typeof PAYMENT_METHOD_LABELS_HE)[]).map((k) => (
                    <SelectItem key={k} value={k}>{PAYMENT_METHOD_LABELS_HE[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("startsOn", "תאריך תחילה", { type: "date" })}
            {field("note", "הערה (למשל מספר קבלה)")}
          </div>
          <Button onClick={submit} disabled={pending || !form.productId} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
            יצירת מסלול
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 4: Page and nav**

`src/app/admin/plans/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/actions/shared";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { BranchUrlFilter } from "@/features/branches/components/BranchUrlFilter";
import { loadKiryatAtaCatalog } from "@/features/enrollment/lib/catalog";
import { listPlansAction } from "@/features/plans/lib/actions/admin-plans";
import { PlansTable } from "@/features/plans/components/admin/PlansTable";
import { ManualGrantDialog } from "@/features/plans/components/admin/ManualGrantDialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { isValidUUID } from "@/lib/validations/common";
import type { PlanStatus } from "@/types/plans";

export const metadata: Metadata = { title: "מסלולים | Garden of Eden" };

const STATUSES: PlanStatus[] = ["active", "ending_soon", "expired", "cancelled"];

interface PageProps {
  searchParams: Promise<{ branch?: string; status?: string }>;
}

export default async function AdminPlansPage({ searchParams }: PageProps) {
  const { error } = await verifyAdmin();
  if (error) redirect("/admin");

  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status);
  const [rows, branches, products] = await Promise.all([
    listPlansAction({ branchId: params.branch && isValidUUID(params.branch) ? params.branch : undefined, status }),
    listActiveBranchOptionsAction(),
    loadKiryatAtaCatalog(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">מסלולים</h1>
          <p className="text-muted-foreground">מי קנה מה, עד מתי, וכמה אימונים נוצלו</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/admin/plans/products">קטלוג</Link></Button>
          <Button variant="outline" asChild><Link href="/admin/orders">הזמנות</Link></Button>
          <ManualGrantDialog products={products} />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <BranchUrlFilter branches={branches} className="w-48" />
        <div className="flex gap-1">
          {[undefined, ...STATUSES].map((s) => (
            <Button key={s ?? "all"} size="sm" variant={status === s ? "default" : "outline"} asChild>
              <Link href={s ? `/admin/plans?status=${s}${params.branch ? `&branch=${params.branch}` : ""}` : "/admin/plans"}>
                {s === undefined ? "הכל" : { active: "פעיל", ending_soon: "מסתיים", expired: "פג", cancelled: "בוטל" }[s]}
              </Link>
            </Button>
          ))}
        </div>
      </div>
      <PlansTable rows={rows} />
    </div>
  );
}
```

In `src/lib/navigation/admin-nav.ts`, add `CreditCard`, `Receipt`, `ShieldAlert` to the lucide import and:

- in the `שחקנים` section after `משתמשים`: `{ href: "/admin/plans", label: "מסלולים", icon: CreditCard, adminOnly: true, mobileOrder: 6 },`
- in the `שיווק ולקוחות` section: `{ href: "/admin/orders", label: "הזמנות", icon: Receipt, adminOnly: true, mobileOrder: 7 },`
- in the `תפעול` section after `שעות עבודה`: `{ href: "/admin/safety", label: "נוהל בטיחות", icon: ShieldAlert, mobileOrder: 6 },`

Add `"/admin/plans/products": "קטלוג מסלולים"` to the `derivePageTitles` extras.

- [ ] **Step 5: Type-check, lint, look, commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. As admin: `/admin/plans` lists the sandbox plan, the status pills filter, the branch filter narrows, the actions dialog extends the end date, a manual grant with a new phone creates a user visible on `/admin/users` with a קריית אתא badge.

```bash
git add src/lib/validations/plans-admin.ts src/features/plans src/app/admin/plans src/lib/navigation/admin-nav.ts
git commit -m "feat(plans): admin plans list with extend, add sessions, cancel, and manual grant

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Catalog CMS

**Files:**
- Create: `src/features/plans/lib/actions/admin-products.ts`, `src/features/plans/components/admin/ProductsClient.tsx`, `src/app/admin/plans/products/page.tsx`

**Interfaces:**
- Produces: `listProductsAction(): Promise<PlanProduct[]>` (all, including inactive), `updateProductAction(id, input: ProductInput)`, `reorderProductsAction(ids)`.

- [ ] **Step 1: Actions**

`src/features/plans/lib/actions/admin-products.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID, UUID_REGEX } from "@/lib/validations/common";
import { productSchema, type ProductInput } from "@/lib/validations/plans-admin";
import type { PlanProduct } from "@/types/plans";

type ActionResult = { success: true } | { error: string; fieldErrors?: Record<string, string[]> };

function revalidate(): void {
  revalidatePath("/admin/plans/products");
  revalidatePath("/admin/plans");
  revalidatePath("/join");
}

export async function listProductsAction(): Promise<PlanProduct[]> {
  const { error } = await verifyAdmin();
  if (error) return [];
  const { data } = (await typedFrom(createAdminClient(), "plan_products")
    .select("*")
    .order("order_index")) as { data: PlanProduct[] | null };
  return (data ?? []).map((p) => ({ ...p, price_ils: Number(p.price_ils) }));
}

/** No create and no delete: the catalog is the price sheet. Deactivate instead. */
export async function updateProductAction(id: string, input: ProductInput): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(id)) return { error: "מזהה מסלול לא תקין" };

  const validated = productSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { error } = await typedFrom(createAdminClient(), "plan_products")
    .update(validated.data)
    .eq("id", id);
  if (error) return { error: "שגיאה בעדכון המסלול" };
  revalidate();
  return { success: true };
}

export async function reorderProductsAction(ids: string[]): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!ids.length || ids.some((id) => !UUID_REGEX.test(id))) return { error: "רשימה לא תקינה" };

  const db = createAdminClient();
  for (const [index, id] of ids.entries()) {
    const { error } = await typedFrom(db, "plan_products").update({ order_index: index }).eq("id", id);
    if (error) return { error: "שגיאה בסידור" };
  }
  revalidate();
  return { success: true };
}
```

- [ ] **Step 2: Client and page**

`src/features/plans/components/admin/ProductsClient.tsx`, copying the branches CMS shape (list rows with up, down, edit; an edit dialog with name, blurb, price, sessions, duration, once-per-trainee switch, gift, active switch):

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { reorderProductsAction, updateProductAction } from "../../lib/actions/admin-products";
import type { ProductInput } from "@/lib/validations/plans-admin";
import type { PlanProduct } from "@/types/plans";

function ProductDialog({ product, onClose }: { product: PlanProduct; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<ProductInput>({
    name_he: product.name_he,
    blurb_he: product.blurb_he ?? "",
    price_ils: product.price_ils,
    sessions_total: product.sessions_total,
    duration_days: product.duration_days,
    once_per_trainee: product.once_per_trainee,
    gift_he: product.gift_he ?? "",
    is_active: product.is_active,
  });
  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = () =>
    startTransition(async () => {
      const result = await updateProductAction(product.id, form);
      if ("error" in result) {
        toast.error(result.fieldErrors ? Object.values(result.fieldErrors)[0]?.[0] ?? result.error : result.error);
        return;
      }
      toast.success("המסלול עודכן");
      router.refresh();
      onClose();
    });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>עריכת {product.name_he}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label>שם</Label><Input value={form.name_he} onChange={(e) => set("name_he", e.target.value)} disabled={pending} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>תיאור קצר</Label><Input value={form.blurb_he ?? ""} onChange={(e) => set("blurb_he", e.target.value)} disabled={pending} /></div>
          <div className="space-y-1"><Label>מחיר (₪)</Label><Input type="number" value={form.price_ils} onChange={(e) => set("price_ils", Number(e.target.value))} disabled={pending} /></div>
          <div className="space-y-1"><Label>משך (ימים)</Label><Input type="number" value={form.duration_days} onChange={(e) => set("duration_days", Number(e.target.value))} disabled={pending} /></div>
          <div className="space-y-1"><Label>אימונים (ריק = לפי זמן)</Label><Input type="number" value={form.sessions_total ?? ""} onChange={(e) => set("sessions_total", e.target.value === "" ? null : Number(e.target.value))} disabled={pending} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>מתנה</Label><Input value={form.gift_he ?? ""} onChange={(e) => set("gift_he", e.target.value)} disabled={pending} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3"><Label>חד-פעמי לשחקן חדש</Label><Switch checked={form.once_per_trainee} onCheckedChange={(v) => set("once_per_trainee", v)} disabled={pending} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3"><Label>מוצג להרשמה</Label><Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} disabled={pending} /></div>
        </div>
        <DialogFooter className="flex-row-reverse gap-2">
          <Button onClick={save} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin ms-2" /> : null}שמור</Button>
          <Button variant="outline" onClick={onClose} disabled={pending}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductsClient({ initialProducts }: { initialProducts: PlanProduct[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PlanProduct | null>(null);
  const [reordering, startReorder] = useTransition();

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= initialProducts.length) return;
    const ids = initialProducts.map((p) => p.id);
    const reordered = ids.map((id, i) => (i === index ? ids[target] : i === target ? ids[index] : id));
    startReorder(async () => {
      const result = await reorderProductsAction(reordered);
      if ("error" in result) toast.error(result.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {editing && <ProductDialog key={editing.id} product={editing} onClose={() => setEditing(null)} />}
      <div className="rounded-lg border divide-y">
        {initialProducts.map((product, index) => (
          <div key={product.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{product.name_he}</span>
                <span className="text-sm text-muted-foreground">₪{product.price_ils.toLocaleString("he-IL")}</span>
                {!product.is_active && <Badge variant="outline">מוסתר</Badge>}
                {product.once_per_trainee && <Badge variant="secondary">חד-פעמי</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {product.sessions_total !== null ? `${product.sessions_total} אימונים · ` : ""}{product.duration_days} ימים
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => move(index, -1)} disabled={reordering || index === 0} aria-label="העבר למעלה"><ArrowUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => move(index, 1)} disabled={reordering || index === initialProducts.length - 1} aria-label="העבר למטה"><ArrowDown className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setEditing(product)} aria-label={`ערוך ${product.name_he}`}><Pencil className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

`src/app/admin/plans/products/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/actions/shared";
import { listProductsAction } from "@/features/plans/lib/actions/admin-products";
import { ProductsClient } from "@/features/plans/components/admin/ProductsClient";

export const metadata: Metadata = { title: "קטלוג מסלולים | Garden of Eden" };

export default async function AdminProductsPage() {
  const { error } = await verifyAdmin();
  if (error) redirect("/admin");
  const products = await listProductsAction();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">קטלוג מסלולים</h1>
        <p className="text-muted-foreground">המחירים והתנאים שמוצגים בעמוד ההרשמה של קריית אתא</p>
      </div>
      <ProductsClient initialProducts={products} />
    </div>
  );
}
```

- [ ] **Step 3: Type-check, lint, look, commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. Reprice a product and confirm `/join` shows the new price; hide one and confirm it disappears from `/join`.

```bash
git add src/features/plans/lib/actions/admin-products.ts src/features/plans/components/admin/ProductsClient.tsx src/app/admin/plans/products
git commit -m "feat(plans): catalog CMS for the קריית אתא products

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Orders page with retry

**Files:**
- Create: `src/features/plans/lib/actions/admin-orders.ts`, `src/features/plans/components/admin/OrdersTable.tsx`, `src/app/admin/orders/page.tsx`

**Interfaces:**
- Produces: `listOrdersAction(): Promise<AdminOrderRow[]>` where `AdminOrderRow = Order & { productName: string; hasAgreement: boolean; agreementId: string | null }`, `retryFulfillmentAction(orderId)`, `listUnassignedWebhookEventsAction(): Promise<MorningWebhookEvent[]>`.

- [ ] **Step 1: Actions**

`src/features/plans/lib/actions/admin-orders.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { fulfillOrder } from "@/features/enrollment/lib/fulfillment";
import { notifyOrderFulfilled } from "@/features/enrollment/lib/notify";
import type { MorningWebhookEvent, Order } from "@/types/plans";

export type AdminOrderRow = Order & {
  productName: string;
  agreementId: string | null;
};

type ActionResult = { success: true } | { error: string };

const ORDERS_LIMIT = 200;

export async function listOrdersAction(): Promise<AdminOrderRow[]> {
  const { error } = await verifyAdmin();
  if (error) return [];
  const db = createAdminClient();

  const { data } = (await typedFrom(db, "orders")
    .select("*, product:plan_products(name_he), agreement:enrollment_agreements(id)")
    .order("created_at", { ascending: false })
    .limit(ORDERS_LIMIT)) as {
    data: (Order & { product: { name_he: string } | null; agreement: { id: string }[] | null })[] | null;
  };

  return (data ?? []).map(({ product, agreement, ...order }) => ({
    ...order,
    amount_ils: Number(order.amount_ils),
    productName: product?.name_he ?? "",
    agreementId: agreement?.[0]?.id ?? null,
  }));
}

/** Re-runs fulfillment for a paid order that failed; every step is idempotent. */
export async function retryFulfillmentAction(orderId: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(orderId)) return { error: "מזהה הזמנה לא תקין" };

  const db = createAdminClient();
  const result = await fulfillOrder(db, orderId);
  if (!result.ok) return { error: result.error };
  await notifyOrderFulfilled(db, orderId);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/plans");
  return { success: true };
}

/** Deliveries that carried no order we know: money to chase by hand. */
export async function listUnassignedWebhookEventsAction(): Promise<MorningWebhookEvent[]> {
  const { error } = await verifyAdmin();
  if (error) return [];
  const { data } = (await typedFrom(createAdminClient(), "morning_webhook_events")
    .select("*")
    .not("error", "is", null)
    .order("received_at", { ascending: false })
    .limit(50)) as { data: MorningWebhookEvent[] | null };
  return data ?? [];
}
```

- [ ] **Step 2: Table and page**

`src/features/plans/components/admin/OrdersTable.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils/date";
import { retryFulfillmentAction, type AdminOrderRow } from "../../lib/actions/admin-orders";
import type { OrderStatus } from "@/types/plans";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "ממתין לתשלום",
  paid: "שולם",
  failed: "נכשל",
  expired: "פג",
};

export function OrdersTable({ rows }: { rows: AdminOrderRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const retry = (orderId: string) =>
    startTransition(async () => {
      const result = await retryFulfillmentAction(orderId);
      if ("error" in result) toast.error(result.error);
      else {
        toast.success("ההזמנה הושלמה");
        router.refresh();
      }
    });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">תאריך</TableHead>
            <TableHead className="text-right">הורה / חניך</TableHead>
            <TableHead className="text-right">מסלול</TableHead>
            <TableHead className="text-right">סכום</TableHead>
            <TableHead className="text-right">סטטוס</TableHead>
            <TableHead className="text-right">מסמכים</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="text-sm text-muted-foreground">{formatDateTime(order.created_at)}</TableCell>
              <TableCell>
                <div className="font-medium">{order.parent_name}</div>
                <div className="text-xs text-muted-foreground">{order.child_name} · {order.login_phone}</div>
              </TableCell>
              <TableCell>{order.productName}</TableCell>
              <TableCell>₪{order.amount_ils.toLocaleString("he-IL")}</TableCell>
              <TableCell>
                <Badge variant={order.status === "paid" ? "default" : "outline"}>{STATUS_LABEL[order.status]}</Badge>
                {order.status === "paid" && !order.fulfilled_at && (
                  <div className="mt-1 space-y-1">
                    <p className="text-xs text-destructive">{order.fulfillment_error ?? "לא הושלם"}</p>
                    <Button size="sm" variant="outline" onClick={() => retry(order.id)} disabled={pending}>
                      <RefreshCw className="h-3 w-3 me-1" />
                      ניסיון חוזר
                    </Button>
                  </div>
                )}
              </TableCell>
              <TableCell className="space-x-2 space-x-reverse">
                {order.morning_document_url && (
                  <a href={order.morning_document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline">
                    <FileText className="h-3 w-3" />חשבונית
                  </a>
                )}
                {order.agreementId && <span className="text-xs text-muted-foreground">הסכם חתום</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

`src/app/admin/orders/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/actions/shared";
import { listOrdersAction, listUnassignedWebhookEventsAction } from "@/features/plans/lib/actions/admin-orders";
import { OrdersTable } from "@/features/plans/components/admin/OrdersTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils/date";

export const metadata: Metadata = { title: "הזמנות | Garden of Eden" };

export default async function AdminOrdersPage() {
  const { error } = await verifyAdmin();
  if (error) redirect("/admin");
  const [orders, unassigned] = await Promise.all([listOrdersAction(), listUnassignedWebhookEventsAction()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">הזמנות</h1>
        <p className="text-muted-foreground">כל ניסיונות הרכישה בעמוד ההרשמה, כולל כאלה שלא הושלמו</p>
      </div>
      {unassigned.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader><CardTitle className="text-base">התראות מ-Morning שלא שויכו ({unassigned.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {unassigned.map((event) => (
              <div key={event.delivery_id} className="flex justify-between gap-4">
                <span>{event.topic} · {event.error}</span>
                <span className="text-muted-foreground">{formatDateTime(event.received_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <OrdersTable rows={orders} />
    </div>
  );
}
```

- [ ] **Step 3: Type-check, lint, check, commit**

Run: `npx tsc && npm run lint`
Expected: clean. Set `fulfilled_at = NULL, fulfillment_error = 'test'` on the sandbox order in SQL, open `/admin/orders`, press ניסיון חוזר: the row loses the error and no second plan appears.

```bash
git add src/features/plans/lib/actions/admin-orders.ts src/features/plans/components/admin/OrdersTable.tsx src/app/admin/orders
git commit -m "feat(plans): orders page with fulfillment retry and unassigned webhooks

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 17: Trainee detail cards, roster badges, users list column

**Files:**
- Create: `src/features/plans/lib/actions/trainee-health.ts`, `src/features/plans/lib/actions/staff-plan-badges.ts`, `src/features/plans/components/UserPlanCard.tsx`, `HealthCard.tsx`, `HealthSheet.tsx`
- Modify: `src/app/admin/users/[userId]/page.tsx`, `src/components/admin/schedule/SlotCard.tsx`, `ScheduleDayView.tsx`, `week/WeekDayColumn.tsx`, `src/app/admin/schedule/page.tsx`, `src/app/admin/weekly-schedule/page.tsx`, `src/components/admin/users/UserTableColumns.tsx`, `UserDataTable.tsx`, `src/app/admin/users/page.tsx`, `src/types/branches.ts`

**Interfaces:**
- Produces:
  - `loadPlanStatusesForStaff(profileIds): Promise<Record<string, StaffPlanBadge>>` with `StaffPlanBadge = { status: PlanStatus; sessionsLeft: number | null; endsOn: string; hasMedicalNotes: boolean }`
  - `getTraineeHealthAction(traineeId)`, `updateTraineeHealthAction(input: HealthInput)`
  - `ProfileWithBranches` gains `planBadge?: StaffPlanBadge`

- [ ] **Step 1: Staff read actions**

`src/features/plans/lib/actions/staff-plan-badges.ts`:

```ts
"use server";

import { cache } from "react";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import type { PlanStatus } from "@/types/plans";
import { loadPlansWithUsage } from "../queries";

export interface StaffPlanBadge {
  status: PlanStatus;
  sessionsLeft: number | null;
  endsOn: string;
  hasMedicalNotes: boolean;
}

/**
 * Plan status and a medical flag for a set of trainees, for roster chips and
 * the users list. Service role: a trainer cannot read trainee_plans or the
 * health columns through RLS. Gated on verifyAdminOrTrainer; callers only
 * pass ids they are already allowed to display.
 */
export const loadPlanStatusesForStaff = cache(
  async (profileIds: readonly string[]): Promise<Record<string, StaffPlanBadge>> => {
    const { error } = await verifyAdminOrTrainer();
    if (error || profileIds.length === 0) return {};

    const db = createAdminClient();
    const [plans, { data: profiles }] = await Promise.all([
      loadPlansWithUsage(db, profileIds, israelToday()),
      db.from("profiles").select("id, medical_notes").in("id", [...profileIds]),
    ]);
    const medical = new Set((profiles ?? []).filter((p) => p.medical_notes).map((p) => p.id));

    const result: Record<string, StaffPlanBadge> = {};
    for (const [profileId, { plan, sessionsUsed, status }] of plans) {
      result[profileId] = {
        status,
        sessionsLeft: plan.sessions_total === null ? null : Math.max(plan.sessions_total - sessionsUsed, 0),
        endsOn: plan.ends_on,
        hasMedicalNotes: medical.has(profileId),
      };
    }
    for (const id of medical) {
      if (!result[id]) result[id] = { status: "active", sessionsLeft: null, endsOn: "", hasMedicalNotes: true };
    }
    return result;
  },
);
```

Note the second loop: a חיפה trainee with medical notes but no plan still gets the warning icon; roster chips test `hasMedicalNotes` and `endsOn !== ""` separately.

`src/features/plans/lib/actions/trainee-health.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validations/common";
import { healthSchema, type HealthInput } from "@/lib/validations/plans-admin";

export interface TraineeHealth {
  medicalNotes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
}

type ActionResult = { success: true } | { error: string };

export async function getTraineeHealthAction(traineeId: string): Promise<TraineeHealth | null> {
  const { error } = await verifyAdminOrTrainer();
  if (error || !isValidUUID(traineeId)) return null;
  const scopeError = await assertTraineeInScope(traineeId);
  if (scopeError) return null;

  const { data } = await createAdminClient()
    .from("profiles")
    .select("medical_notes, emergency_contact_name, emergency_contact_phone, guardian_name, guardian_phone")
    .eq("id", traineeId)
    .maybeSingle();
  if (!data) return null;
  return {
    medicalNotes: data.medical_notes,
    emergencyContactName: data.emergency_contact_name,
    emergencyContactPhone: data.emergency_contact_phone,
    guardianName: data.guardian_name,
    guardianPhone: data.guardian_phone,
  };
}

/** Trainers may correct health data for trainees in their branch: a parent tells them at the field. */
export async function updateTraineeHealthAction(input: HealthInput): Promise<ActionResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = healthSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  const scopeError = await assertTraineeInScope(parsed.data.traineeId);
  if (scopeError) return { error: scopeError };

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({
      medical_notes: parsed.data.medicalNotes,
      emergency_contact_name: parsed.data.emergencyContactName,
      emergency_contact_phone: parsed.data.emergencyContactPhone,
    })
    .eq("id", parsed.data.traineeId);
  if (error) return { error: "שגיאה בשמירה" };

  await db.from("activity_logs").insert({
    user_id: parsed.data.traineeId,
    action: "user_updated",
    actor_id: user!.id,
    actor_name: profile?.full_name ?? "צוות",
    changes: [{ field: "health", old_value: null, new_value: "עודכן" }],
  });

  revalidatePath(`/admin/users/${parsed.data.traineeId}`);
  revalidatePath("/admin/schedule");
  return { success: true };
}
```

- [ ] **Step 2: Cards and sheet**

`src/features/plans/components/UserPlanCard.tsx` (admin controls reuse `PlanActionsDialog`):

```tsx
"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { shortDate } from "@/lib/utils/iso-date";
import type { AdminPlanRow } from "../lib/actions/admin-plans";
import { PlanActionsDialog } from "./admin/PlanActionsDialog";
import { PlanStatusBadge } from "./PlanStatusBadge";

export function UserPlanCard({ row, isAdmin }: { row: AdminPlanRow; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />מסלול</CardTitle>
        <CardDescription>{row.product.name_he}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between"><span className="text-muted-foreground">סטטוס</span><PlanStatusBadge status={row.status} /></div>
        {row.plan.sessions_total !== null && (
          <div className="flex items-center justify-between"><span className="text-muted-foreground">אימונים</span><span>{row.sessionsUsed} / {row.plan.sessions_total}</span></div>
        )}
        <div className="flex items-center justify-between"><span className="text-muted-foreground">תוקף</span><span>{shortDate(row.plan.starts_on)} עד {shortDate(row.plan.ends_on)}</span></div>
        {row.orderDocumentUrl && (
          <a href={row.orderDocumentUrl} target="_blank" rel="noreferrer" className="block text-sm underline">חשבונית ב-Morning</a>
        )}
        {isAdmin && (
          <>
            <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>פעולות</Button>
            {open && <PlanActionsDialog row={row} onClose={() => setOpen(false)} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

`src/features/plans/components/HealthCard.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HeartPulse, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateTraineeHealthAction, type TraineeHealth } from "../lib/actions/trainee-health";

function local(phone: string | null): string {
  if (!phone) return "";
  return phone.startsWith("+972") ? `0${phone.slice(4)}` : phone;
}

export function HealthCard({ traineeId, health }: { traineeId: string; health: TraineeHealth }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [medical, setMedical] = useState(health.medicalNotes ?? "");
  const [name, setName] = useState(health.emergencyContactName ?? "");
  const [phone, setPhone] = useState(local(health.emergencyContactPhone));

  const save = () =>
    startTransition(async () => {
      const result = await updateTraineeHealthAction({
        traineeId,
        medicalNotes: medical,
        emergencyContactName: name,
        emergencyContactPhone: phone,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("נשמר");
      setEditing(false);
      router.refresh();
    });

  return (
    <Card className={health.medicalNotes ? "border-amber-500/60" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><HeartPulse className="h-4 w-4" />בריאות וחירום</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {editing ? (
          <>
            <div className="space-y-1"><Label htmlFor="h-medical">מגבלות רפואיות</Label><Textarea id="h-medical" rows={2} value={medical} onChange={(e) => setMedical(e.target.value)} disabled={pending} /></div>
            <div className="space-y-1"><Label htmlFor="h-name">איש קשר לחירום</Label><Input id="h-name" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} /></div>
            <div className="space-y-1"><Label htmlFor="h-phone">טלפון לחירום</Label><Input id="h-phone" dir="ltr" className="text-right" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={pending} /></div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={pending}>{pending ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : null}שמירה</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>ביטול</Button>
            </div>
          </>
        ) : (
          <>
            <div><div className="text-muted-foreground">מגבלות רפואיות</div><div className={health.medicalNotes ? "font-medium text-amber-700" : ""}>{health.medicalNotes ?? "אין"}</div></div>
            <div><div className="text-muted-foreground">איש קשר לחירום</div>
              {health.emergencyContactPhone ? (
                <a href={`tel:${health.emergencyContactPhone}`} className="inline-flex items-center gap-1 font-medium underline"><Phone className="h-3 w-3" />{health.emergencyContactName} · {local(health.emergencyContactPhone)}</a>
              ) : (<div>לא צוין</div>)}
            </div>
            {health.guardianPhone && (
              <div><div className="text-muted-foreground">הורה משלם</div>
                <a href={`tel:${health.guardianPhone}`} className="inline-flex items-center gap-1 underline"><Phone className="h-3 w-3" />{health.guardianName} · {local(health.guardianPhone)}</a>
              </div>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>עריכה</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

`src/features/plans/components/HealthSheet.tsx` (opened from a roster chip; loads on open through the scoped action):

```tsx
"use client";

import { useEffect, useState } from "react";
import { HeartPulse, Phone } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getTraineeHealthAction, type TraineeHealth } from "../lib/actions/trainee-health";

interface HealthSheetProps {
  traineeId: string;
  traineeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HealthSheet({ traineeId, traineeName, open, onOpenChange }: HealthSheetProps) {
  const [health, setHealth] = useState<TraineeHealth | null | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getTraineeHealthAction(traineeId).then((h) => {
      if (!cancelled) setHealth(h);
    });
    return () => {
      cancelled = true;
    };
  }, [open, traineeId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" dir="rtl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-amber-600" />{traineeName}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4 text-sm">
          {health === undefined && <p className="text-muted-foreground">טוען...</p>}
          {health === null && <p className="text-muted-foreground">אין הרשאה או אין נתונים</p>}
          {health && (
            <>
              <div><div className="text-muted-foreground">מגבלות רפואיות</div><div className="font-medium">{health.medicalNotes ?? "אין"}</div></div>
              {health.emergencyContactPhone && (
                <a href={`tel:${health.emergencyContactPhone}`} className="flex items-center gap-2 rounded-xl border p-3 font-medium">
                  <Phone className="h-4 w-4" />{health.emergencyContactName}: {health.emergencyContactPhone}
                </a>
              )}
              {health.guardianPhone && (
                <a href={`tel:${health.guardianPhone}`} className="flex items-center gap-2 rounded-xl border p-3">
                  <Phone className="h-4 w-4" />הורה: {health.guardianName} {health.guardianPhone}
                </a>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: User detail page**

In `src/app/admin/users/[userId]/page.tsx`, import `listPlansAction` from `@/features/plans/lib/actions/admin-plans`, `getTraineeHealthAction`, `UserPlanCard`, `HealthCard`. For trainees, after the existing branch loads:

```ts
  const [planRows, health] = userToEdit.role === "trainee"
    ? await Promise.all([
        isAdmin ? listPlansAction({}) : Promise.resolve([]),
        getTraineeHealthAction(userId),
      ])
    : [[], null];
  const planRow = planRows.find((row) => row.plan.profile_id === userId) ?? null;
```

`listPlansAction` is admin-only; for trainers, plan status comes from `loadPlanStatusesForStaff([userId])` instead and the card shows read-only fields. To keep one card, when `!isAdmin` build a `planRow` from `loadPlanStatusesForStaff` only for the badge, and render `UserPlanCard` only when `planRow` is available (admins); render a small status line with `PlanStatusBadge` for trainers. In the main column, after `AccessTierCard`:

```tsx
          {userToEdit.role === "trainee" && planRow && (
            <UserPlanCard row={planRow} isAdmin={isAdmin} />
          )}
          {userToEdit.role === "trainee" && health && (
            <HealthCard traineeId={userId} health={health} />
          )}
```

- [ ] **Step 4: Roster chip and users list**

Add to `src/types/branches.ts`:

```ts
import type { StaffPlanBadge } from "@/features/plans/lib/actions/staff-plan-badges";
export type ProfileWithBranches = Profile & {
  branchIds: string[];
  branchNames: string[];
  planBadge?: StaffPlanBadge;
};
```

(replace the existing `ProfileWithBranches` definition; a type-only import from a `"use server"` module is allowed).

In `src/app/admin/users/page.tsx`, after `usersWithBranches` is built, load badges and attach:

```ts
  const badges = await loadPlanStatusesForStaff(usersWithBranches.map((u) => u.id));
  const usersWithPlans = usersWithBranches.map((u) => ({ ...u, planBadge: badges[u.id] }));
```

and pass `usersWithPlans` to the table and export. In `UserTableColumns.tsx`, add a column after `branches`:

```tsx
  {
    id: "plan",
    header: "מסלול",
    cell: ({ row }) =>
      row.original.planBadge && row.original.planBadge.endsOn ? (
        <PlanStatusBadge status={row.original.planBadge.status} className="text-xs" />
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      ),
    enableSorting: false,
  },
```

with `import { PlanStatusBadge } from "@/features/plans/components/PlanStatusBadge";`.

In `src/app/admin/schedule/page.tsx` and `src/app/admin/weekly-schedule/page.tsx`, after the slots load, collect roster trainee ids and load badges:

```ts
  const rosterIds = Array.from(new Set(slots.flatMap((s) => s.trainees.map((t) => t.trainee_id).filter((id): id is string => id !== null))));
  const planBadges = await loadPlanStatusesForStaff(rosterIds);
```

Pass `planBadges` through `ScheduleDayView` (new prop `planBadges: Record<string, StaffPlanBadge>`) to `SlotCard`, and through `WeeklySchedulePageClient` to `DatedWeekView` to `WeekDayColumn` to `SlotCard`. In `SlotCard.tsx`, for a linked trainee, next to the name inside the badge render:

```tsx
                    {planBadges[trainee.trainee_id]?.status === "expired" && (
                      <span className="ms-1 rounded-full bg-destructive px-1.5 text-[10px] text-white">פג</span>
                    )}
                    {planBadges[trainee.trainee_id]?.status === "ending_soon" && (
                      <span className="ms-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-black">מסתיים</span>
                    )}
```

and, outside the `Link`, a small warning button when `planBadges[trainee.trainee_id]?.hasMedicalNotes` that opens `HealthSheet` for that trainee (keep one `useState<{ id: string; name: string } | null>` for the open sheet per card):

```tsx
                <button
                  type="button"
                  onClick={() => setHealthTarget({ id: trainee.trainee_id!, name: trainee.trainee_name })}
                  aria-label={`מידע רפואי: ${trainee.trainee_name}`}
                  className="text-amber-600"
                >
                  <HeartPulse className="h-4 w-4" />
                </button>
```

and at the end of the card:

```tsx
      {healthTarget && (
        <HealthSheet traineeId={healthTarget.id} traineeName={healthTarget.name} open onOpenChange={(o) => !o && setHealthTarget(null)} />
      )}
```

- [ ] **Step 5: Type-check, lint, check, commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. As a trainer in קריית אתא: the roster chip of the sandbox trainee shows no badge while active, a פג badge after `ends_on` is moved to the past, and a heart icon once `medical_notes` is set; the sheet shows the emergency contact as a call link. The trainee page shows both cards; a trainer can edit the health card, an admin also gets the plan actions.

```bash
git add src/features/plans src/types/branches.ts "src/app/admin/users/[userId]/page.tsx" src/app/admin/users/page.tsx src/components/admin/users src/components/admin/schedule src/app/admin/schedule/page.tsx src/app/admin/weekly-schedule/page.tsx
git commit -m "feat(plans): plan status and health data on the trainee page, roster, and users list

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 18: Safety protocol page and branch manager phone

**Files:**
- Create: `src/features/safety/components/SafetyProtocol.tsx`, `src/app/admin/safety/page.tsx`
- Modify: `src/lib/validations/branch.ts`, `src/features/branches/lib/actions/admin-branches.ts`, `src/features/branches/components/admin/BranchesClient.tsx`, `src/components/admin/schedule/ScheduleDayView.tsx`

- [ ] **Step 1: Manager phone on branches**

In `src/lib/validations/branch.ts`, add to `branchSchema`:

```ts
  manager_phone: z
    .string()
    .trim()
    .regex(PHONE_REGEX_IL, "מספר טלפון לא תקין")
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : formatPhoneToInternational(v)))
    .nullish()
    .transform((v) => v ?? null),
```

with `PHONE_REGEX_IL` and `formatPhoneToInternational` imported from `@/lib/validations/common`. In `admin-branches.ts`, add `manager_phone: validated.data.manager_phone,` to both the insert and the update objects. In `BranchesClient.tsx`, add a `managerPhone` state seeded from `branch?.manager_phone ?? ""`, an input labelled "טלפון מנהל המתחם" after the Arbox field, and `manager_phone: managerPhone.trim() || null` in the input object.

- [ ] **Step 2: Protocol component and page**

`src/features/safety/components/SafetyProtocol.tsx`:

```tsx
import { Phone } from "lucide-react";
import { EMERGENCY_NUMBERS, SAFETY_SECTIONS } from "../../../../content/safety-protocol";

interface SafetyProtocolProps {
  managerPhone: string | null;
  branchName: string | null;
}

export function SafetyProtocol({ managerPhone, branchName }: SafetyProtocolProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3">
        {EMERGENCY_NUMBERS.map((n) => (
          <a key={n.number} href={`tel:${n.number}`} className="inline-flex items-center gap-1 rounded-full bg-destructive px-3 py-1 text-sm font-bold text-white">
            <Phone className="h-3 w-3" />{n.label}: {n.number}
          </a>
        ))}
        {managerPhone ? (
          <a href={`tel:${managerPhone}`} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium">
            <Phone className="h-3 w-3" />מנהל המתחם{branchName ? ` (${branchName})` : ""}: {managerPhone}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">טלפון מנהל המתחם: לא הוגדר (עמוד הסניפים)</span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {SAFETY_SECTIONS.map((section, index) => (
          <section key={section.title} className="rounded-2xl border p-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#CDEA68] text-xs text-black">{index + 1}</span>
              {section.title}
            </h2>
            <p className="mb-2 text-xs text-muted-foreground">{section.subtitle}</p>
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {section.items.map((item) => (<li key={item}>{item}</li>))}
            </ul>
          </section>
        ))}
      </div>

      <section className="rounded-2xl border p-4 print:break-before-page">
        <h2 className="mb-2 text-lg font-bold">טופס דיווח אירוע (להדפסה)</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {["שם המתאמן", "תאריך ושעה", "מאמן מדווח", "תיאור האירוע", "הטיפול שניתן", "יידוע ההורים (מי, מתי, איך)"].map((label) => (
            <div key={label} className="border-b border-dashed pb-6"><span className="text-xs text-muted-foreground">{label}</span></div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

`src/app/admin/safety/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAllBranches } from "@/features/branches/lib/memberships";
import { allowedBranches, resolveRequestedBranch } from "@/lib/branches/resolve-branch";
import { toBranchOption } from "@/types/branches";
import { SafetyProtocol } from "@/features/safety/components/SafetyProtocol";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export const metadata: Metadata = { title: "נוהל בטיחות וחירום | Garden of Eden" };

interface PageProps {
  searchParams: Promise<{ branch?: string }>;
}

export default async function SafetyPage({ searchParams }: PageProps) {
  const { error } = await verifyAdminOrTrainer();
  if (error) redirect("/dashboard");
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) redirect("/dashboard");

  const params = await searchParams;
  const all = await loadAllBranches(createAdminClient());
  const active = all.filter((b) => b.is_active).map(toBranchOption);
  const branchId = resolveRequestedBranch({ requested: params.branch, scope: scopeResult.data.scope, branches: active });
  const branch = all.find((b) => b.id === branchId) ?? null;
  void allowedBranches;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">נוהל בטיחות וחירום</h1>
          <p className="text-muted-foreground">נוהל פנימי לצוות המאמנים</p>
        </div>
        <PrintButton />
      </div>
      <SafetyProtocol managerPhone={branch?.manager_phone ?? null} branchName={branch?.name_he ?? null} />
    </div>
  );
}
```

Remove the `void allowedBranches;` line and the `allowedBranches` and `Button`/`Printer` imports from the page; the print control is its own client component because Next refuses `javascript:` URLs:

`src/features/safety/components/PrintButton.tsx`:

```tsx
"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer className="h-4 w-4 me-2" />
      הדפסה
    </Button>
  );
}
```

and import it in the page with `import { PrintButton } from "@/features/safety/components/PrintButton";`.

In `ScheduleDayView.tsx`, add a link button next to `CopyWhatsAppButton`:

```tsx
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/safety?branch=${branchId}`}><ShieldAlert className="h-4 w-4" />נוהל בטיחות</Link>
          </Button>
```

with `ShieldAlert` added to the lucide import.

- [ ] **Step 3: Type-check, lint, check, commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. Set a manager phone on קריית אתא in `/admin/branches`; `/admin/safety?branch=<id>` shows the three emergency numbers and the manager as tap-to-call links, seven sections, and a printable report form. Trainers reach it from the daily board.

```bash
git add src/features/safety src/app/admin/safety src/lib/validations/branch.ts src/features/branches src/components/admin/schedule/ScheduleDayView.tsx
git commit -m "feat(safety): staff safety protocol page with emergency and manager numbers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 19: Plan 3 wrap-up

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`
Expected: clean, baseline failures only, build compiles.

- [ ] **Step 2: Reviews**

Run the `security-reviewer` and `code-reviewer` agents on `git diff feat/branches...HEAD`, with the same focus areas as the branches review plus: the unauthenticated checkout action and webhook, the public agreement URL, service-role reads on public pages, and trainer scope on health edits. Fix findings before handoff.

- [ ] **Step 3: CLAUDE.md and commit**

Under the signup architecture note add: "Admin surfaces: `/admin/plans`, `/admin/plans/products`, `/admin/orders`. Staff health data on the roster comes from `loadPlanStatusesForStaff()`; the protocol lives at `/admin/safety` from `content/safety-protocol.ts`."

```bash
git add CLAUDE.md
git commit -m "docs(plans): admin and staff surfaces for קריית אתא plans

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Then push `feat/kiryat-ata-signup` and open a PR against `feat/branches` (or against `main` once PR #27 has merged), with the sandbox round-trip checklist as the test plan.
