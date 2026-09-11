# Staff-recorded payments, Morning receipts, and deferred agreement signing

Date: 2026-09-11. Extends `2026-09-10-kiryat-ata-signup-design.md`.

## Problem

Parents who pay in cash, by bank transfer, or with Bit are today handled by
one admin-only dialog that retypes the whole enrollment, records the order
as if Morning took the money, and never issues a receipt. Trainers cannot do
anything. Renewing an existing trainee means filling the form again.

## Decisions made with the owner

- Amount is always the catalog price. No discounts in the app.
- Payment methods: מזומן, העברה בנקאית, ביט.
- The parent signs the digital agreement afterwards, from a WhatsApp link.
  Staff never sign on the parent's behalf.
- Trainers can record payments and sign up new trainees for their branch.
  Extend, add sessions, cancel, the catalog, and the orders page stay admin.

## Flows

### A. Existing trainee (renewal or a second plan)

On the trainee page a staff member opens "תשלום ידני" on the plan card (or on
an empty plan card when the trainee has none): picks the product, the
method, an optional reference (אסמכתא), the start date (today by default),
and two switches: הפק חשבונית ב-Morning (on when Morning is configured) and
שלח אישור בוואטסאפ (on). One submit:

1. inserts a paid `orders` row: `payment_provider = 'manual'`,
   `payment_method`, `reference`, `received_by = staff id`, phones and names
   copied from the profile (login phone = `profiles.phone`, payer =
   `guardian_phone` or the login phone when none, parent name =
   `guardian_name` or "הורה");
2. inserts an **unsigned** `enrollment_agreements` row (see D);
3. runs `fulfillFromInput` (existing: reuses the account, chains the plan
   after a running one);
4. issues the Morning receipt (see C) and stores the document id and url on
   the order; a failure is recorded in `fulfillment_error` and the order
   shows "הפק חשבונית" on `/admin/orders`;
5. writes `activity_logs` (`plan_granted`) naming the staff member and the
   method;
6. sends the existing plan-confirmed WhatsApp whose link now opens the
   signing page.

### B. New trainee

The existing "הרשמה ידנית" dialog on `/admin/plans`, with the same method,
reference, and invoice fields, opened to trainers. Product choice is limited
to branches the trainer can write. Same pipeline as A through a shared
`recordManualPayment()`.

### C. Morning receipt for non-card payments

`createInvoiceReceipt` becomes `createReceiptDocument` taking a discriminated
`payment` (`card | cash | transfer | bit`) mapped to Morning's payment
object: cash `type 1`, bank transfer `type 4`, payment app `type 10` with
`appType` for Bit, card `type 3` as today. The reference goes into the
document `remarks`. The mapping lives in one pure function with tests; the
type codes are verified against the Morning sandbox in the last task and
corrected there if the docs differ. `issueOrderInvoice(db, orderId)` wraps
it for the card path, the manual path, and the admin retry.

### D. Deferred signing

Migration: `enrollment_agreements.signed_at` becomes nullable with no
default, `signature_name` and `parent_id_number` default to '', and the
declarations CHECK becomes `signed_at IS NULL OR (all three true)`. A manual
payment inserts a row with `signed_at NULL`, the current `TERMS_VERSION`,
the plan and price, and the parent details known from the profile.

`/join/agreement/[id]?t=<hmac>` (existing token, no expiry) renders the
signing form while `signed_at` is null and the printable copy afterwards.
The form asks only for what staff could not enter: parent ID number,
medical notes and emergency contact (prefilled from the profile), the three
declarations, photo consent, and the typed signature. `signAgreementAction`
verifies the token, validates, sets `signed_at`, `signed_ip`, and copies
medical notes, emergency contact, and photo consent onto the profile when
those are empty there. Signing is one-way: a signed row is never re-opened.

Staff see "הסכם: לא נחתם" on the plan card and in the plans table with a
"שלח שוב" button (`resendAgreementLinkAction`, staff, branch scoped) that
re-sends the plan-confirmed template.

### E. Who sees what

| Surface | Admin | Trainer |
|---|---|---|
| Trainee page plan card + תשלום ידני | yes | trainees in branch |
| `/admin/plans` list + הרשמה ידנית | all | branch only (nav no longer adminOnly) |
| Extend / add sessions / cancel | yes | no |
| `/admin/orders`, הפק חשבונית retry, catalog | yes | no |

Every staff action goes `verifyAdminOrTrainer` → `assertTraineeInScope` or
`assertBranchWritable(product.branch_id)` → service role, as
`trainee-health.ts` does. RLS is unchanged: trainers still cannot read these
tables directly.

## Out of scope

Discounts, partial payments, refunds, invoices for חיפה (Arbox), automatic
reminders to sign (staff resend by hand for now).
