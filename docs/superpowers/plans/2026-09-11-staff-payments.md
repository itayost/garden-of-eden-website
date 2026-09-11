# Staff Payments, Morning Receipts, Deferred Signing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff (admins and branch trainers) record cash / transfer / Bit payments for new or existing trainees, Morning issues the חשבונית מס קבלה, and the parent signs the digital agreement from a WhatsApp link.

**Architecture:** One server-only `recordManualPayment()` behind two actions (existing trainee from the trainee page, new trainee from the plans page). One `issueOrderInvoice()` behind the card path, the manual path, and an admin retry. Agreements gain an unsigned state; the existing token-guarded agreement page grows a signing form.

**Tech Stack:** Next.js 16 server actions, Supabase service role behind `verifyAdminOrTrainer` + branch scope, Zod 4, react-hook-form, Morning documents API, Vitest for pure helpers.

**Spec:** `docs/superpowers/specs/2026-09-11-staff-payments-design.md`

## Global Constraints

- Hebrew UI, logical CSS (`ms-`/`me-`, `ps-`/`pe-`), no emojis, immutability.
- Untyped tables through `typedFrom()`; ids through `isValidUUID()` / Zod UUID.
- Staff actions: `verifyAdminOrTrainer()` then `assertTraineeInScope(id)` (from `@/lib/actions/shared/assert-trainee`) or `assertBranchWritable(branchId)` (from `@/lib/actions/shared/assert-branch`), then `createAdminClient()`.
- `verifyAdmin()` returns `adminProfile`; `verifyAdminOrTrainer()` returns `profile`.
- Prices always from `plan_products.price_ils`. Methods: `cash | transfer | bit`.
- Tests only for pure functions. Baseline: 20 known localStorage failures; 11 lint warnings.
- Commit per task with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Migration: manual payment columns, unsigned agreements, activity actions

**Files:**
- Create: `supabase/migrations/20260912100000_staff_payments.sql`
- Modify: `src/types/plans.ts`, `src/types/activity-log.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Manual payments taken by staff: how, with what reference, and by whom.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('cash', 'transfer', 'bit', 'card')),
  ADD COLUMN IF NOT EXISTS reference TEXT CHECK (reference IS NULL OR char_length(reference) <= 60),
  ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Agreements may now wait for the parent's signature. Until signed the
-- declarations are false and the signature empty; signing is one-way.
ALTER TABLE public.enrollment_agreements
  ALTER COLUMN signed_at DROP NOT NULL,
  ALTER COLUMN signed_at DROP DEFAULT,
  ALTER COLUMN signature_name SET DEFAULT '',
  ALTER COLUMN parent_id_number SET DEFAULT '',
  ALTER COLUMN emergency_contact_name SET DEFAULT '',
  ALTER COLUMN emergency_contact_phone SET DEFAULT '';
ALTER TABLE public.enrollment_agreements DROP CONSTRAINT IF EXISTS agreement_declarations_true;
ALTER TABLE public.enrollment_agreements
  ADD CONSTRAINT agreement_signed_means_declared
  CHECK (
    signed_at IS NULL
    OR (declares_healthy AND accepts_terms AND authorizes_payment
        AND signature_name <> '' AND parent_id_number <> '')
  );
CREATE INDEX IF NOT EXISTS idx_enrollment_agreements_unsigned
  ON public.enrollment_agreements (profile_id) WHERE signed_at IS NULL;

-- Staff enter only what the parent cannot; the parent adds the birthdate
-- when signing. One automatic reminder to sign, stamped here.
ALTER TABLE public.orders ALTER COLUMN child_birthdate DROP NOT NULL;
ALTER TABLE public.enrollment_agreements
  ALTER COLUMN child_birthdate DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS sign_reminded_at TIMESTAMPTZ;

-- Existing rows were all signed at insert; nothing to backfill.

-- Activity log gains the two staff payment events.
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_action_check;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_action_check CHECK (action IN (
  'user_created', 'user_updated', 'user_activated', 'user_deactivated', 'user_deleted',
  'bulk_users_created', 'role_changed', 'profile_updated', 'avatar_updated', 'avatar_cleared',
  'stats_created', 'stats_updated', 'assessment_created', 'assessment_updated', 'assessment_deleted',
  'shift_change_request_created', 'shift_change_request_approved', 'shift_change_request_rejected',
  'shift_change_request_cancelled', 'access_override_changed',
  'measurement_created', 'measurement_updated', 'measurement_deleted',
  'plan_granted', 'invoice_issued'
));
```

Before writing, confirm the current constraint name and value list with `grep -n "activity_logs_action_check\|CHECK (action IN" supabase/migrations/*.sql | tail -3`; copy the latest list verbatim and append the five new values (the three `measurement_*` values are written by nutrition code today but missing from the CHECK, so include them).

- [ ] **Step 2: Types**

In `src/types/plans.ts`:
```ts
export type PaymentMethod = "cash" | "transfer" | "bit" | "card";
export const PAYMENT_METHOD_LABELS_HE: Record<PaymentMethod, string> = {
  cash: "מזומן",
  transfer: "העברה בנקאית",
  bit: "ביט",
  card: "כרטיס אשראי",
};
```
Add to `Order`: `payment_method: PaymentMethod | null; reference: string | null; received_by: string | null;`.
Change `EnrollmentAgreement.signed_at` to `string | null`, `EnrollmentAgreement.child_birthdate` and `Order.child_birthdate` to `string | null`, add `EnrollmentAgreement.sign_reminded_at: string | null`. Then grep `child_birthdate` and guard every render (`ddmmyyyy` calls) and `fulfillment.ts` (`birthdate: profile?.birthdate || order.child_birthdate` already tolerates null).
Remove `PAYMENT_METHOD_LABELS_HE` from `src/lib/validations/plans-admin.ts` and update its importers (`ManualGrantDialog.tsx`, `admin-plans.ts`) to import from `@/types/plans`.

In `src/types/activity-log.ts` add `"plan_granted"` and `"invoice_issued"` to `ACTIVITY_ACTIONS` and Hebrew labels `plan_granted: "מסלול נרשם"`, `invoice_issued: "חשבונית הופקה"` in `ACTIVITY_ACTION_LABELS_HE` (read the file first; the const may be a tuple or union).

- [ ] **Step 3: Push and verify**

Run: `supabase db push --dry-run` then `supabase db push`. Then `npx tsc --noEmit`. Fix any callers that assumed `signed_at: string` (grep `signed_at`).

- [ ] **Step 4: Commit**

`git commit -m "feat(plans): manual payment columns, unsigned agreements, activity actions"`

---

### Task 2: Validation schemas with tests

**Files:**
- Modify: `src/lib/validations/plans-admin.ts`
- Create: `src/lib/validations/agreement-sign.ts`, `src/lib/validations/__tests__/plans-admin.test.ts`, `src/lib/validations/__tests__/agreement-sign.test.ts`

**Interfaces produced:**
```ts
// plans-admin.ts
export const manualPaymentMethodSchema = z.enum(["cash", "transfer", "bit"]);
export const manualGrantSchema = z.object({   // REPLACES the old one: the short field form
  productId: uuid,
  childName: z.string().trim().min(2).max(100).regex(SINGLE_LINE),
  loginPhone: phone,                              // the child's WhatsApp
  payerPhone: phone,                              // the dialog copies loginPhone when "אותו מספר" is on
  parentName: optionalText(100),                  // optional; the parent confirms it when signing
  paymentMethod: manualPaymentMethodSchema,
  reference: optionalText(60),
  startsOn: isoDate,
  sendWhatsApp: z.boolean(),
  confirmDuplicate: z.boolean().default(false),   // set after the duplicate guard prompt
});
export const staffPaymentSchema = z.object({     // existing trainee: no start date, chaining decides
  traineeId: uuid, productId: uuid, paymentMethod: manualPaymentMethodSchema,
  reference: optionalText(60), sendWhatsApp: z.boolean(),
  confirmDuplicate: z.boolean().default(false),
});
export type StaffPaymentInput = z.input<typeof staffPaymentSchema>;
export const issueInvoiceSchema = z.object({ orderId: uuid });
export const resendAgreementSchema = z.object({ agreementId: uuid });

// agreement-sign.ts
export const signAgreementSchema = z.object({
  agreementId: uuid, token: z.string().regex(/^[0-9a-f]{64}$/),
  parentIdNumber: z.string().transform(strip).refine(isValidIsraeliId, "מספר תעודת זהות לא תקין"),
  childBirthdate: isoDate.refine(ageBetween(4, 25)),   // reuse the age rule from enrollment.ts
  parentName: z.string().trim().min(2).max(100).regex(SINGLE_LINE),
  parentEmail: emailOrEmpty,                            // same as enrollment.ts email
  medicalNotes: optionalText(500),
  emergencyContactName: z.string().trim().min(2).max(100).regex(SINGLE_LINE),
  emergencyContactPhone: phoneField,           // same regex+transform as enrollment.ts
  declaresHealthy: mustBeTrue("יש לאשר את הצהרת הבריאות"),
  acceptsTerms: mustBeTrue("יש לאשר את התקנון"),
  authorizesPayment: mustBeTrue("יש לאשר את החיוב"),
  photoConsent: z.enum(["yes", "no"], { message: "יש לבחור לגבי צילום" }).transform((v) => v === "yes"),
  signatureName: z.string().trim().min(2).max(100).regex(SINGLE_LINE),
});
export type SignAgreementInput = z.input<typeof signAgreementSchema>;
```
Reuse the `phoneField`, `optionalText`, `mustBeTrue`, `SINGLE_LINE` definitions from `enrollment.ts`: export them from there rather than copying.

- [ ] **Step 1: Write the failing tests** (`staffPaymentSchema` accepts a full input and rejects `paymentMethod: "card"`; `manualGrantSchema` accepts child name + two phones + product + method only; `signAgreementSchema` rejects a false declaration, an invalid ID, a birthdate outside 4 to 25, and maps `photoConsent` to boolean).
- [ ] **Step 2: Run**: `npm run test:run -- src/lib/validations/__tests__/plans-admin.test.ts src/lib/validations/__tests__/agreement-sign.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** the schemas as above.
- [ ] **Step 4: Run** the same command → PASS. `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(plans): staff payment and agreement signing schemas`

---

### Task 3: Morning receipts for any payment method

**Files:**
- Create: `src/lib/morning/payment-mapping.ts`, `src/lib/morning/__tests__/payment-mapping.test.ts`
- Modify: `src/lib/morning/documents.ts`, `src/features/enrollment/lib/actions/charge-order.ts`

**Interfaces produced:**
```ts
// payment-mapping.ts (pure)
export type ReceiptPayment =
  | { kind: "card"; brand: CardBrand; last4: string; installments: number }
  | { kind: "cash" }
  | { kind: "transfer"; reference: string | null }
  | { kind: "bit"; reference: string | null };
/** Morning payment object for POST /documents. Codes: 1 cash, 3 card, 4 bank transfer, 10 payment app (appType 1 = Bit). */
export function morningPaymentObject(payment: ReceiptPayment, amountIls: number, paidOn: string): Record<string, unknown>;
export function receiptRemarks(payment: ReceiptPayment): string | undefined;   // "אסמכתא: <ref>" when present

// documents.ts
export interface ReceiptInput { description; amountIls; paidOn; client: {name; phone; email|null}; payment: ReceiptPayment }
export async function createReceiptDocument(input: ReceiptInput): Promise<InvoiceReceiptResult>;
```

- [ ] **Step 1: Failing test** for `morningPaymentObject`: card → `{type:3, cardType:2 for visa, cardNum, dealType:1, numPayments:1, price, currency:"ILS", date}`; cash → `{type:1, price, currency, date}`; transfer → `{type:4,...}`; bit → `{type:10, appType:1, ...}`; `receiptRemarks` returns `אסמכתא: 12345` for a transfer with reference and `undefined` for cash.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; move `CARD_TYPE` from `documents.ts` into the mapping file. **Step 4: Run** → PASS.
- [ ] **Step 5: Refactor `documents.ts`**: rename `createInvoiceReceipt` → `createReceiptDocument`, body uses `payment: [morningPaymentObject(...)]` and `remarks: receiptRemarks(...)`. Update `charge-order.ts` to pass `payment: { kind: "card", brand, last4, installments }`.
- [ ] **Step 6:** `npx tsc --noEmit && npm run lint`. **Commit** `feat(morning): receipts for cash, transfer, and Bit`

---

### Task 4: Shared `issueOrderInvoice` and the admin retry

**Files:**
- Create: `src/features/enrollment/lib/invoice.ts`
- Modify: `src/features/enrollment/lib/actions/charge-order.ts`, `src/features/plans/lib/actions/admin-orders.ts`, `src/features/plans/components/admin/OrdersTable.tsx`

```ts
// invoice.ts ("server-only")
/** Issues the Morning receipt for a paid order and stores the document; best-effort, never throws. */
export async function issueOrderInvoice(db: SupabaseClient, orderId: string, actor: { id: string | null; name: string | null }):
  Promise<{ ok: true; url: string | null } | { ok: false; error: string }>
```
Loads the order (must be `paid`, no `morning_document_id` yet, else returns ok with the existing url), product name, builds `ReceiptPayment` from `payment_method` (`card` → brand/last4/installments from the row; `cash`; `transfer`/`bit` with `reference`), calls `createReceiptDocument`, on success updates `morning_document_id/url` and clears an `invoice:` prefixed `fulfillment_error`, inserts `activity_logs` (`invoice_issued`, `user_id = order.profile_id`, actor) when `profile_id` is set; on failure writes `fulfillment_error: 'invoice: ...'`. Returns `{ok:false, error:"Morning אינו מוגדר"}` when `!isMorningConfigured()`.

- [ ] **Step 1:** Write `invoice.ts`. **Step 2:** In `charge-order.ts` replace the inline Morning block with `await issueOrderInvoice(db, order.id, { id: null, name: null })` after fulfillment.
- [ ] **Step 3:** In `admin-orders.ts` add `issueInvoiceAction(orderId)` (`verifyAdmin`, `isValidUUID`, calls the helper, `revalidatePath("/admin/orders")`, `revalidatePath("/admin/plans")`).
- [ ] **Step 4:** In `OrdersTable.tsx` show a "הפק חשבונית" button (with `useTransition` + toast, like the existing retry) for rows with `status === "paid" && !morning_document_url`; show `PAYMENT_METHOD_LABELS_HE[row.payment_method]` and `reference` in the סכום cell.
- [ ] **Step 5:** tsc, lint. **Commit** `feat(orders): issue or retry the Morning receipt from the orders page`

---

### Task 5: Shared `recordManualPayment` and the new-trainee dialog for staff

**Files:**
- Create: `src/features/plans/lib/manual-payment.ts`
- Modify: `src/features/plans/lib/actions/admin-plans.ts` (`grantPlanAction`), `src/features/plans/components/admin/ManualGrantDialog.tsx`, `src/app/admin/plans/page.tsx`

```ts
// manual-payment.ts ("server-only")
export interface ManualPaymentInput {
  product: PlanProduct;
  trainee: { profileId: string | null; loginPhone: string; childName: string; childBirthdate: string | null };
  parent: { name: string; phone: string; email: string | null };
  health: { medicalNotes: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null };
  paymentMethod: "cash" | "transfer" | "bit";
  reference: string | null;
  /** Null lets renewalStartDate chain after a running plan (existing trainee). */
  startsOn: string | null;
  sendWhatsApp: boolean;
  actor: { id: string; name: string | null };
}
export interface ManualPaymentResult {
  ok: true; orderId: string; profileId: string; planId: string;
  endsOn: string;
  invoice: { url: string | null; error: string | null; skipped: boolean };   // skipped when Morning is not configured
  whatsapp: { sentTo: string | null; error: string | null };
  agreementUrl: string;                                                       // the signing link, for "העתק"
}
export async function recordManualPayment(db: SupabaseClient, input: ManualPaymentInput): Promise<ManualPaymentResult | { ok: false; error: string }>
/** A manual plan for the same trainee and product in the last 10 minutes; the dialogs ask before repeating. */
export async function findRecentDuplicate(db: SupabaseClient, profileId: string, productId: string): Promise<{ minutesAgo: number } | null>
```
`notifyOrderFulfilled` must return `{ welcome: WhatsAppResult | null; confirmed: WhatsAppResult }` instead of `void` so the result sheet can report it (update its four callers; they ignore the value).
Steps inside: insert `orders` (`status: "paid"`, `paid_at`, `payment_provider: "manual"`, `payment_method`, `reference`, `received_by: actor.id`, amount = product price, names/phones from input, `profile_id` when known); insert `enrollment_agreements` with `signed_at: null`, `agreement_version: TERMS_VERSION`, `payment_method: PAYMENT_METHOD_LABELS_HE[method]`, `plan_start_on: startsOn`, declarations false, `photo_consent: false`, `signature_name: ""`, `parent_id_number: ""`, emergency fields from input or `""`; `fulfillFromInput(db, { order, product, agreement, createdBy: actor.id })`; patch `trainee_plans` window when `startsOn !== israelToday()` (copy from today's `grantPlanAction`) and set `note` to `${PAYMENT_METHOD_LABELS_HE[method]}${reference ? ` ${reference}` : ""}`; `activity_logs` insert (`plan_granted`, `user_id: profileId`, `actor_id`, `actor_name`, `metadata: { orderId, productId, paymentMethod, reference }`); `issueOrderInvoice` when `issueInvoice && isMorningConfigured()`; `notifyOrderFulfilled(db, order.id)` when `sendWhatsApp`.

- [ ] **Step 1:** Write `manual-payment.ts`.
- [ ] **Step 2:** `grantPlanAction`: `verifyAdminOrTrainer()`, parse `manualGrantSchema`, load the product, `assertBranchWritable(product.branch_id)`, refuse a `loginPhone` owned by a staff profile (same check as `start-checkout.ts`), find an existing trainee by `phoneVariants(loginPhone)` and, when found and `!confirmDuplicate`, run `findRecentDuplicate` and return `{ duplicate: { minutesAgo } }`; build `ManualPaymentInput` (`parent.name: parentName ?? "הורה"`, `childBirthdate: null`, `health` all null), call the helper, return the `ManualPaymentResult`.
- [ ] **Step 3: Shared UI pieces** in `src/features/plans/components/staff/`: `PaymentMethodPicker` (three large toggle buttons, `reference` input shown for transfer and Bit with hint "4 ספרות אחרונות של האסמכתא"), `PaymentResult` (the result list: plan until, invoice line with link and "העתק קישור" or error with "נסה שוב" calling `issueInvoiceAction`, WhatsApp line with "שלח שוב" calling `resendAgreementLinkAction`, "העתק קישור לחתימה"), `DuplicatePrompt`. All inside `SheetDialogContent`.
- [ ] **Step 4:** Rewrite `ManualGrantDialog` as `NewTraineeSheet({ products, morningConfigured })`: child name, login phone, "אותו מספר" switch that mirrors it into the payer phone, optional parent name, product cards, `PaymentMethodPicker`, start date (today), WhatsApp switch; the invoice line is informational ("חשבונית תופק אוטומטית ב-Morning" or "חשבונית תופק ידנית ב-Morning"). On `{ duplicate }` show `DuplicatePrompt` then resubmit with `confirmDuplicate: true`. On success swap the body for `PaymentResult`.
- [ ] **Step 5:** `src/app/admin/plans/page.tsx`: `verifyAdminOrTrainer`; products filtered to branches the caller can write; render `NewTraineeSheet`. Also render it in the users page header (`src/app/admin/users/page.tsx`) next to the import button, for both roles.
- [ ] **Step 6:** tsc, lint. **Commit** `feat(plans): staff record cash, transfer, and Bit signups with a receipt`

---

### Task 6: Existing trainee: payment dialog on the trainee page

**Files:**
- Create: `src/features/plans/lib/actions/staff-payment.ts`, `src/features/plans/components/staff/StaffPaymentSheet.tsx`, `src/features/plans/components/staff/PlanSheet.tsx`
- Modify: `src/features/plans/lib/actions/admin-plans.ts` (`getPlanForProfileAction` trainer access), `src/features/plans/components/UserPlanCard.tsx`, `src/app/admin/users/[userId]/page.tsx`, `src/components/admin/schedule/SlotCard.tsx`, `src/features/plans/lib/actions/staff-plan-badges.ts`

```ts
// staff-payment.ts ("use server")
export async function recordTraineePaymentAction(input: StaffPaymentInput): Promise<ManualPaymentResult | { duplicate: { minutesAgo: number } } | { error: string }>
export async function getStaffPaymentContextAction(traineeId: string): Promise<{
  traineeName: string; products: PlanProduct[]; currentProductId: string | null;
  /** What chaining will do: the computed start date and why. */
  startsOn: string; startsAfterCurrent: boolean; morningConfigured: boolean; parentPhone: string | null;
} | { error: string }>   // staff only, branch scoped; products limited to the trainee's branches the caller can write
```
`recordTraineePaymentAction`: `verifyAdminOrTrainer` → parse → `assertTraineeInScope(traineeId)` → load product → `assertBranchWritable(product.branch_id)` → load profile (`phone, full_name, birthdate, guardian_name, guardian_phone, email, medical_notes, emergency_contact_*`; refuse when `role !== "trainee"` or `phone` null with "לחניך אין טלפון להתחברות") → `recordManualPayment` with `profileId`, `loginPhone: profile.phone` (normalize with `formatPhoneToInternational` if it starts with 0 or 972), `parent.phone: guardian_phone ?? phone`, `parent.name: guardian_name ?? "הורה"`, `childBirthdate: birthdate ?? today` → `revalidatePath` for `/admin/users/${traineeId}`, `/admin/plans`, `/admin/orders`.

`getPlanForProfileAction`: `verifyAdminOrTrainer` + `assertTraineeInScope`; `listPlansAction` stays admin for now (Task 8 opens it).

- [ ] **Step 1:** Write the action file.
- [ ] **Step 2:** `StaffPaymentSheet({ traineeId, open, onOpenChange })`: loads `getStaffPaymentContextAction` on open (skeleton meanwhile); product cards with the current plan's product preselected; a line "יתחיל ב-DD/MM, אחרי סיום המסלול הנוכחי" or "מתחיל היום"; `PaymentMethodPicker`; WhatsApp switch with the parent phone shown; the invoice information line; submit with `useTransition`; `DuplicatePrompt` on `{ duplicate }`; `PaymentResult` on success; `router.refresh()` on close. When `products` is empty render the branch hint instead of the form.
- [ ] **Step 3:** `PlanSheet({ traineeId, traineeName, open, onOpenChange })`: read-only plan summary (status badge, sessions used, ends on, agreement signed or not with "שלח שוב") from `getPlanForProfileAction`, one primary button "רישום תשלום" that opens `StaffPaymentSheet`. In `SlotCard.tsx`, the פג/מסתיים chip (and a new small ₪ chip for every trainee with a plan badge) opens `PlanSheet`; `StaffPlanBadge` gains `agreementSigned: boolean | null` so unsigned shows a small pen icon.
- [ ] **Step 4:** `UserPlanCard` gains props `{ row: AdminPlanRow | null; isAdmin: boolean; traineeId; hasProducts: boolean }`; renders the empty state ("אין מסלול פעיל") when `row` is null; shows "רישום תשלום / חידוש" opening `StaffPaymentSheet` when `hasProducts`, else the branch hint; keeps admin-only פעולות. Trainee page: load `planRow` for trainers too and render the card for every trainee.
- [ ] **Step 5:** tsc, lint. **Commit** `feat(plans): staff renew or add a plan from the trainee page`

---

### Task 7: Deferred signing

**Files:**
- Create: `src/features/enrollment/lib/actions/sign-agreement.ts`, `src/features/enrollment/components/AgreementSignForm.tsx`, `src/features/enrollment/components/AgreementDeclarations.tsx`
- Modify: `src/app/join/agreement/[id]/page.tsx`, `src/features/enrollment/components/EnrollmentForm.tsx` (extract declarations), `src/features/enrollment/components/AgreementPrintable.tsx`, `src/features/plans/lib/actions/admin-plans.ts` (`AdminPlanRow.agreementSigned`, `agreementId`), `src/features/plans/lib/actions/staff-payment.ts` (`resendAgreementLinkAction`), `src/features/plans/components/UserPlanCard.tsx`, `src/features/plans/components/admin/PlansTable.tsx`, `src/features/enrollment/lib/notify.ts`

- [ ] **Step 1: Extract `AgreementDeclarations`** from `EnrollmentForm` (the three `DeclarationField`s and the photo consent block) as a component taking `control: Control<T>` generic over `{ declaresHealthy; acceptsTerms; authorizesPayment; photoConsent }`, so both forms share it. `EnrollmentForm` renders it; behavior unchanged.
- [ ] **Step 2: `signAgreementAction(input: SignAgreementInput)`** (unauthenticated, `"use server"`): rate limit `checkout` by IP; parse; `verifyAgreementToken(agreementId, token, planTokenSecret())` else `{error:"הקישור אינו תקין"}`; load the agreement; if `signed_at` already set return `{ ok: true }`; update the row (`parent_id_number`, `medical_notes`, `emergency_contact_*`, declarations, `photo_consent`, `signature_name`, `signed_at: now`, `signed_ip`, `agreement_version: TERMS_VERSION`); if `profile_id` set, update the profile's `medical_notes`, `emergency_contact_name/phone`, `photo_consent` only where currently null; return `{ ok: true }`.
- [ ] **Step 3: `AgreementSignForm({ agreement, token, receiptUrl })`** (client, phone-first like `EnrollmentForm`): summary card (child, plan, price, start date), then the parent's own fields: parent name (prefilled), ID number, email, child birthdate, medical notes, emergency contact (prefilled where known), `AgreementDeclarations`, signature; required marks; sticky submit "חתימה על ההסכם"; on success `router.refresh()` so the page renders the printable copy, a "תודה, ההסכם נחתם" banner, and the receipt link when the order has one. `signAgreementAction` also writes `child_birthdate` to the agreement and `birthdate`, `email` to the profile when empty.
- [ ] **Step 4: Page branch**: in `join/agreement/[id]/page.tsx`, `data.signed_at ? <AgreementPrintable/> : <AgreementSignForm agreement={data} token={t} />`. `AgreementPrintable`: guard `signed_at` null (render "טרם נחתם").
- [ ] **Step 5: Staff visibility**: `AdminPlanRow` gains `agreementId: string | null; agreementSigned: boolean` (join `enrollment_agreements` by `order_id` in `loadAdminRows`). `UserPlanCard` and `PlansTable` show a `Badge` "הסכם נחתם" / "הסכם לא נחתם" and, when unsigned, a "שלח שוב" button calling `resendAgreementLinkAction(agreementId)`.
- [ ] **Step 6: `resendAgreementLinkAction`**: `verifyAdminOrTrainer` → load agreement + order → `assertTraineeInScope(agreement.profile_id)` → `notifyOrderFulfilled(db, order.id)` (welcome is skipped when already sent; plan-confirmed carries the link); returns the WhatsApp result for the toast.
- [ ] **Step 7: Cron nudge**: in `reminders.ts`, `remindUnsignedAgreements(db)`: agreements with `signed_at IS NULL`, `sign_reminded_at IS NULL`, `created_at < now - 3 days`, and an order with `profile_id`; call `notifyOrderFulfilled` and stamp `sign_reminded_at`. Count into `ReminderRunResult.signReminders`.
- [ ] **Step 8:** tsc, lint, `npm run test:run`. **Commit** `feat(signup): parents sign the agreement from the WhatsApp link after a staff payment`

---

### Task 8: Plans page for trainers

**Files:**
- Modify: `src/features/plans/lib/actions/admin-plans.ts` (`listPlansAction`), `src/lib/navigation/admin-nav.ts`, `src/app/admin/plans/page.tsx`, `src/features/plans/components/admin/PlansTable.tsx`

- [ ] **Step 1:** `listPlansAction`: `verifyAdminOrTrainer`; `getBranchScopeAction()`; `visibleProfileIds(db, scope, filter.branchId)` → when an array, intersect with the profile ids from `trainee_plans`; an empty array returns `[]` without querying (no empty `.in()`).
- [ ] **Step 2:** `admin-nav.ts`: drop `adminOnly` from `/admin/plans`; keep it on `/admin/orders` and `/admin/plans/products`. Page: hide the קטלוג and הזמנות buttons unless `profile.role === "admin"`; `BranchUrlFilter` receives `allowedBranches(scope, branches)`.
- [ ] **Step 3:** `PlansTable({ rows, isAdmin })`: the פעולות button only for admins; every row gets "רישום תשלום" opening `StaffPaymentSheet`; manual plans show "נרשם ע"י <name>" (join `orders.received_by` to `profiles.full_name` in `loadAdminRows`) and the parent phone as a `tel:` link.
- [ ] **Step 4:** tsc, lint. **Commit** `feat(plans): trainers see their branch on the plans page`

---

### Task 9: Copy, docs, memory

- [ ] Template wording for Meta (still pending approval): the plan-confirmed body must introduce {{5}} as "לצפייה ולחתימה על ההסכם:" since manual payments send the signing link. Write the final Hebrew body for both templates into `docs/superpowers/specs/2026-09-11-staff-payments-design.md` under a "WhatsApp templates" heading for Itay to submit.
- [ ] CLAUDE.md, section "קריית אתא signup": add two sentences on `recordManualPayment()` / `issueOrderInvoice()` and the unsigned-agreement state.
- [ ] **Commit** `docs(plans): staff payments and deferred signing`

---

### Task 10: Verification and delivery

- [ ] `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`.
- [ ] Security review agent on `git diff main...HEAD` with focus: trainer scope on every new action, the unauthenticated `signAgreementAction` (token, rate limit, one-way signing, no PII beyond the agreement's own), `received_by` integrity, no client-supplied amounts.
- [ ] Code review agent: unsigned agreement rendering everywhere `signed_at` was assumed, empty `.in()`, remount keys on the new dialogs.
- [ ] Morning sandbox check (needs `MORNING_*` env in `.env.local`, sandbox keys): issue one receipt each for cash, transfer, Bit through `issueOrderInvoice` against a test order; confirm the payment type codes render correctly in the sandbox document; correct `payment-mapping.ts` and its test if Morning's codes differ.
- [ ] Manual smoke (Itay, WhatsApp OTP login): trainer records a cash renewal for a trainee in their branch; admin signs up a new trainee with Bit; parent link opens the signing form, signs, page turns into the printable copy; "הסכם נחתם" appears on the trainee page.
- [ ] Push, PR against `main`, merge, watch the production deploy.
