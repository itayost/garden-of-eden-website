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

## UX review (2026-09-11, before execution)

Staff take money at the field, on a phone, with the child in front of them.
The parent is elsewhere and reaches the app only through WhatsApp. The
flows are designed around that.

### Entry points, in order of use

1. **Daily board chip.** A roster chip already shows פג / מסתיים. Tapping
   the chip's status opens a plan sheet: status, sessions left, ends on,
   agreement state, and one button "רישום תשלום". This is where a trainer
   renews a child whose card ran out, without leaving the board.
2. **Plans page**, filtered to פג תוקף / מסתיים בקרוב: the "who to chase"
   list, each row with the same payment button and the parent's phone.
3. **Trainee page** plan card: for everything else, and for admins.
4. **New trainee**: "הרשמה ידנית" on the plans page and on the users page
   header, both for staff.

### The new-trainee form is short

Staff type only what the parent cannot fill later: child name, the child's
WhatsApp phone (login), the parent's phone (a switch "אותו מספר" copies the
login phone, the common case for young children), product, method,
reference. Birthdate, email, medical notes, emergency contact, and photo
consent are collected from the parent on the signing page. To allow this,
`orders.child_birthdate` and `enrollment_agreements.child_birthdate`
become nullable; the signing action writes the birthdate to the agreement
and to `profiles.birthdate`. A trainee who has not been signed for shows
"ההורה טרם חתם" on staff surfaces and the usual profile-completeness nudge
in the app.

### The renewal form has no start date

Chaining is automatic: a plan renewed while the current one is running
starts the day after it ends; otherwise today. The dialog states which
("יתחיל ב-12/10, אחרי סיום המסלול הנוכחי" / "מתחיל היום"). The product is
preselected to the current plan's product with the price shown; staff can
change it. Admins keep a date override in the plans table actions.

### Method picker and reference

Three large buttons (מזומן, העברה בנקאית, ביט), cash selected by default.
The reference field appears for transfer and Bit with the hint "4 ספרות
אחרונות של האסמכתא" and is optional.

### Result sheet, not a toast

After submit the same sheet shows what happened, line by line:
המסלול נרשם עד DD/MM; חשבונית הופקה (link, "העתק קישור") or חשבונית לא
הופקה (reason, "נסה שוב"); הודעת וואטסאפ נשלחה ל-05X (or failed, "שלח שוב").
Staff must know whether the parent got the link before the family walks
away. A parent with no email cannot receive the receipt from Morning, so
the receipt link is always shown here for staff to forward.

### Guards

- Duplicate: if the same trainee received a manual plan for the same
  product in the last 10 minutes, the sheet asks "נרשם תשלום זהה לפני 3
  דקות. להמשיך?" before submitting.
- Branch: the payment button only renders when the trainee belongs to a
  branch that has products (today: קריית אתא). A חיפה trainee shows
  "המסלולים באפליקציה זמינים לסניף קריית אתא; חיפה מנוהל ב-Arbox".
- Morning off: no dead toggle. The invoice switch is replaced by the line
  "חשבונית תופק ידנית ב-Morning" until the keys are set.
- Accountability: `received_by` and the activity log name the staff
  member; the plans and orders tables show "נרשם ע"י" for manual plans.

### The parent's side

- The plan-confirmed template text must read "לצפייה ולחתימה על ההסכם"
  before the link, since for manual payments the link opens the signing
  form. The template is still pending at Meta; wording goes in now.
- The signing page is phone-first: what is being signed (child, plan,
  price, start), the fields the parent owns, declarations, signature, and,
  after signing, the printable copy plus the receipt link when one exists.
- Unsigned after 3 days: the daily cron re-sends the confirmation once
  (`sign_reminded_at` on the agreement). Staff can resend at any time.

### Phone-sized surfaces

All three new surfaces (payment sheet, new-trainee sheet, result) use
`SheetDialogContent`, which is a bottom sheet on a phone and a dialog on
desktop, with the header pinned and the body scrolling.

## WhatsApp templates (for Meta submission)

Both are Hebrew, category Utility, five body parameters, no header, no
buttons (the link is a body parameter so it works for both the signing page
and the printable copy).

**plan_confirmed** (`WHATSAPP_PLAN_CONFIRMED_TEMPLATE_NAME`)

> היי {{1}}, הרישום של {{2}} למסלול {{3}} בגארדן אוף עדן קריית אתא נקלט.
> המסלול בתוקף עד {{4}}.
> לצפייה ולחתימה על הסכם ההרשמה: {{5}}
> אם משהו לא מדויק, כתבו לנו כאן.

Sample values: רונית, דני, מנוי חודשי, 10/10/2026, https://www.edengarden.co.il/join/agreement/…

**plan_reminder** (`WHATSAPP_PLAN_REMINDER_TEMPLATE_NAME`)

> היי {{1}}, המסלול {{3}} של {{2}} בגארדן אוף עדן {{4}}.
> לחידוש בכרטיס אשראי: {{5}}
> אפשר גם לשלם במזומן, בהעברה או בביט אצל הצוות במגרש.

Sample values: רונית, דני, כרטיסיית 10, מסתיים בעוד 3 ימים, https://www.edengarden.co.il/join?renew=…

## Out of scope

Discounts, partial payments, refunds, invoices for חיפה (Arbox), automatic
reminders to sign (staff resend by hand for now).
