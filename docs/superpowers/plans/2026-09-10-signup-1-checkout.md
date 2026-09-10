# קריית אתא Signup, Plan 1 of 3: Catalog, Agreement, Checkout, Fulfillment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A parent can pick a קריית אתא plan on `/join`, sign the digital enrollment agreement, pay on Morning's hosted page, and end up with a login account, a branch link, a plan, and a WhatsApp confirmation, with Morning issuing the receipt.

**Architecture:** New tables for the catalog, orders, plans, agreements, and webhook deliveries. A `src/lib/morning/` client (OAuth client-credentials token, payment form, HMAC verifier). A public `/join` route group with the agreement form. One server action starts checkout; one signed webhook marks orders paid and runs an idempotent fulfillment module. Pure rules (plan status, session counting, eligibility, tokens) live in `src/lib/plans/` and are unit-tested.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase, Zod 4, React Hook Form, Vitest, Morning API (OAuth 2 client credentials, `POST /payments/form`, webhooks).

**Spec:** `docs/superpowers/specs/2026-09-10-kiryat-ata-signup-design.md`. Plan 2 (`2026-09-10-signup-2-plans-reminders.md`) covers plan status on the dashboard and the reminder cron. Plan 3 (`2026-09-10-signup-3-staff.md`) covers admin and trainer surfaces and the safety page.

## Global Constraints

- All user-facing text in Hebrew; logical CSS properties (`ms-`, `me-`, `start`, `end`); `dir="rtl"` is already on `<html>`.
- No emojis in code, comments, or docs. No em dashes in user-facing copy.
- Immutability: never mutate objects or arrays.
- Admin actions call `verifyAdmin()`; staff actions `verifyAdminOrTrainer()`; both from `@/lib/actions/shared`. Public actions have no auth but must rate limit with `checkRateLimit(identifier, "payment")`, which fails closed.
- Validate every id with `isValidUUID()` or `UUID_REGEX` from `@/lib/validations/common`. Phones are normalized with `formatPhoneToInternational()`.
- `createAdminClient()` only inside server code; the public checkout and the webhook are server code by definition, and are the only unauthenticated writers.
- Tables not in generated types are read with `typedFrom(supabase, "table")`.
- No mock-based tests. Unit tests cover pure functions only.
- Files 200-400 lines typical, 800 max.
- Migration file: `20260911120000_kiryat_ata_signup.sql` (unique version).
- Do not edit `.env*` files; the plan lists the variables to add by hand.
- Commit format: `feat(signup): ...`, `test(signup): ...`, `docs(signup): ...`.
- After every task: `npx tsc --noEmit` and `npm run lint` clean (11 pre-existing warnings are the baseline; 0 errors). `npm run test:run` baseline is 20 failures in two localStorage test files that fail on main.
- Sandbox first: `MORNING_ENV=sandbox` until a sandbox payment has round-tripped.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `supabase/migrations/20260911120000_kiryat_ata_signup.sql` | Five tables, profile and branch columns, seed, RLS, column guard |
| `src/types/plans.ts` | Row types and unions for the five tables, `PlanStatus` |
| `src/lib/plans/plan-status.ts` | `resolvePlanStatus`, `countSessionsUsedFromRows`, `renewalStartDate` |
| `src/lib/plans/eligibility.ts` | `isIntroPackEligible` |
| `src/lib/plans/renewal-token.ts` | `signRenewalToken`, `verifyRenewalToken` |
| `src/lib/plans/phone-variants.ts` | `phoneVariants` for the mixed phone formats in `profiles` |
| `src/lib/validations/israeli-id.ts` | `isValidIsraeliId` |
| `src/lib/validations/enrollment.ts` | `enrollmentSchema`, `EnrollmentInput` |
| `src/lib/morning/config.ts` | Hosts and env reading |
| `src/lib/morning/auth.ts` | Token cache |
| `src/lib/morning/client.ts` | `createPaymentForm` |
| `src/lib/morning/webhook.ts` | `verifyMorningSignature`, `extractOrderId`, payload types |
| `content/terms-kiryat-ata.ts` | תקנון sections and `TERMS_VERSION` |
| `src/features/enrollment/lib/catalog.ts` | `loadKiryatAtaCatalog` |
| `src/features/enrollment/lib/actions/start-checkout.ts` | `startCheckoutAction` |
| `src/features/enrollment/lib/actions/order-status.ts` | `getOrderStatusAction` |
| `src/features/enrollment/lib/fulfillment.ts` | `fulfillOrder` |
| `src/features/enrollment/lib/notify.ts` | WhatsApp confirmations |
| `src/features/enrollment/components/PlanCatalog.tsx` | Product cards |
| `src/features/enrollment/components/EnrollmentForm.tsx` | The agreement form |
| `src/features/enrollment/components/TermsSheet.tsx` | The תקנון in a sheet |
| `src/app/join/page.tsx`, `src/app/join/layout.tsx` | Public catalog page |
| `src/app/join/success/page.tsx`, `src/app/join/failed/page.tsx` | Return pages |
| `src/app/join/terms/page.tsx` | Full תקנון |
| `src/app/join/agreement/[id]/page.tsx` | Printable signed agreement |
| `src/app/api/webhooks/morning/route.ts`, `src/app/api/webhooks/morning/notify/route.ts` | Webhook endpoints |
| tests under `src/lib/plans/__tests__/`, `src/lib/validations/__tests__/`, `src/lib/morning/__tests__/`, `content/__tests__/` | |

**Modified:**

| File | Change |
|---|---|
| `src/types/database.ts` | profiles columns |
| `src/lib/env.ts` | Morning vars required |
| `src/lib/supabase/middleware.ts` | nothing: `/join` is not under a protected path |
| `.env.local.example` | New variables documented |

---

### Task 1: Migration, types, and environment

**Files:**
- Create: `supabase/migrations/20260911120000_kiryat_ata_signup.sql`
- Create: `src/types/plans.ts`
- Modify: `src/types/database.ts` (profiles Row, Insert, Update)
- Modify: `src/lib/env.ts`
- Modify: `.env.local.example`

**Interfaces:**
- Produces: tables `plan_products`, `orders`, `trainee_plans`, `enrollment_agreements`, `morning_webhook_events`; `profiles.guardian_name`, `guardian_phone`, `medical_notes`, `emergency_contact_name`, `emergency_contact_phone`, `photo_consent`; `branches.manager_phone`; TS types `PlanProduct`, `PlanKind`, `Order`, `OrderStatus`, `TraineePlan`, `PlanStatus`, `EnrollmentAgreement`, `MorningWebhookEvent`.

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260911120000_kiryat_ata_signup.sql`:

```sql
-- ===========================================
-- קריית אתא self-service signup.
--
-- Trainees of the new branch are not in Arbox. They buy a plan on the site,
-- pay through Morning, and the site tracks what they bought and until when.
-- See docs/superpowers/specs/2026-09-10-kiryat-ata-signup-design.md.
-- ===========================================

-- ---------- catalog ----------
CREATE TABLE plan_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9_]{2,40}$'),
  name_he TEXT NOT NULL CHECK (char_length(name_he) BETWEEN 1 AND 80),
  blurb_he TEXT CHECK (blurb_he IS NULL OR char_length(blurb_he) <= 200),
  kind TEXT NOT NULL CHECK (kind IN ('subscription', 'session_card', 'term', 'addon')),
  price_ils NUMERIC(10,2) NOT NULL CHECK (price_ils > 0),
  sessions_total INTEGER CHECK (sessions_total IS NULL OR sessions_total > 0),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  once_per_trainee BOOLEAN NOT NULL DEFAULT false,
  gift_he TEXT CHECK (gift_he IS NULL OR char_length(gift_he) <= 200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_row_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER plan_products_set_updated_at
  BEFORE UPDATE ON plan_products
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- ---------- orders ----------
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES plan_products(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
  amount_ils NUMERIC(10,2) NOT NULL CHECK (amount_ils > 0),
  currency TEXT NOT NULL DEFAULT 'ILS',
  parent_name TEXT NOT NULL,
  payer_phone TEXT NOT NULL,
  login_phone TEXT NOT NULL,
  child_name TEXT NOT NULL,
  child_birthdate DATE NOT NULL,
  email TEXT,
  profile_id UUID REFERENCES profiles(id),
  renewal_of_plan_id UUID,
  morning_payment_url TEXT,
  morning_transaction_id TEXT UNIQUE,
  morning_document_id TEXT,
  morning_document_url TEXT,
  raw_webhook JSONB,
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  fulfillment_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_login_phone ON orders(login_phone);
CREATE INDEX idx_orders_profile ON orders(profile_id);

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- ---------- plans ----------
CREATE TABLE trainee_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES plan_products(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  order_id UUID REFERENCES orders(id),
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL CHECK (ends_on >= starts_on),
  sessions_total INTEGER CHECK (sessions_total IS NULL OR sessions_total > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  source TEXT NOT NULL CHECK (source IN ('online', 'manual')),
  note TEXT,
  reminded_3_days_at TIMESTAMPTZ,
  reminded_last_session_at TIMESTAMPTZ,
  reminded_expired_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trainee_plans_profile ON trainee_plans(profile_id);
CREATE INDEX idx_trainee_plans_ends_on ON trainee_plans(ends_on) WHERE status = 'active';

CREATE TRIGGER trainee_plans_set_updated_at
  BEFORE UPDATE ON trainee_plans
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

ALTER TABLE orders
  ADD CONSTRAINT orders_renewal_of_plan_fk
  FOREIGN KEY (renewal_of_plan_id) REFERENCES trainee_plans(id);

-- ---------- agreements ----------
CREATE TABLE enrollment_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  profile_id UUID REFERENCES profiles(id),
  agreement_version TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  parent_id_number TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_email TEXT,
  child_name TEXT NOT NULL,
  child_birthdate DATE NOT NULL,
  medical_notes TEXT,
  plan_name TEXT NOT NULL,
  plan_price_ils NUMERIC(10,2) NOT NULL,
  plan_start_on DATE NOT NULL,
  payment_method TEXT NOT NULL,
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  declares_healthy BOOLEAN NOT NULL,
  accepts_terms BOOLEAN NOT NULL,
  authorizes_payment BOOLEAN NOT NULL,
  photo_consent BOOLEAN NOT NULL,
  signature_name TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signed_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agreement_declarations_true
    CHECK (declares_healthy AND accepts_terms AND authorizes_payment)
);
CREATE INDEX idx_enrollment_agreements_order ON enrollment_agreements(order_id);
CREATE INDEX idx_enrollment_agreements_profile ON enrollment_agreements(profile_id);

-- ---------- webhook deliveries ----------
CREATE TABLE morning_webhook_events (
  delivery_id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  order_id UUID REFERENCES orders(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error TEXT
);

-- ---------- profile and branch columns ----------
ALTER TABLE profiles
  ADD COLUMN guardian_name TEXT,
  ADD COLUMN guardian_phone TEXT,
  ADD COLUMN medical_notes TEXT,
  ADD COLUMN emergency_contact_name TEXT,
  ADD COLUMN emergency_contact_phone TEXT,
  ADD COLUMN photo_consent BOOLEAN;

ALTER TABLE branches ADD COLUMN manager_phone TEXT;

-- ---------- seed: the seven products from the price sheet ----------
DO $$
DECLARE
  v_branch UUID;
BEGIN
  SELECT id INTO v_branch FROM branches WHERE name_he = 'קריית אתא';
  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'branch קריית אתא is missing; apply 20260910120000_branches.sql first';
  END IF;

  INSERT INTO plan_products
    (branch_id, slug, name_he, blurb_he, kind, price_ils, sessions_total, duration_days, once_per_trainee, gift_he, order_index)
  VALUES
    (v_branch, 'monthly', 'מנוי חודשי', '2 אימונים בשבוע (כ-106 ₪ לאימון)', 'subscription', 850, NULL, 30, false, NULL, 0),
    (v_branch, 'intro_pack', 'חבילת היכרות', '4 מפגשים (90 ₪ למפגש). חד-פעמי לשחקן חדש', 'session_card', 360, 4, 98, true, NULL, 1),
    (v_branch, 'card_10', 'כרטיסיית 10 אימונים', '125 ₪ לאימון. תוקף: 14 שבועות', 'session_card', 1250, 10, 98, false, NULL, 2),
    (v_branch, 'card_20', 'כרטיסיית 20 אימונים', '100 ₪ לאימון. תוקף: 28 שבועות', 'session_card', 2000, 20, 196, false, NULL, 3),
    (v_branch, 'term_4_months', 'מתקדמים - 4 חודשים', '2 אימונים בשבוע, 100 ₪ לאימון. הבחירה המשתלמת ביותר', 'term', 3200, NULL, 120, false, 'מתנה לבחירה: מפגש תזונה אישי או מפגש מנטלי אישי', 4),
    (v_branch, 'addon_monthly', 'מנטלי + תזונה + טקטי', 'ליווי חודשי', 'addon', 350, NULL, 30, false, NULL, 5),
    (v_branch, 'addon_single', 'מנטלי + תזונה + טקטי - מפגש חד פעמי', 'מפגש אחד', 'addon', 250, 1, 30, false, NULL, 6);
END $$;

-- ---------- RLS ----------
ALTER TABLE plan_products ENABLE ROW LEVEL SECURITY;
-- The public /join page reads the catalog with the anon key.
CREATE POLICY "plan_products_select_public" ON plan_products
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "plan_products_write_admin" ON plan_products
  FOR ALL TO authenticated
  USING (get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (get_user_role((SELECT auth.uid())) = 'admin');

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_admin" ON orders
  FOR SELECT TO authenticated
  USING (get_user_role((SELECT auth.uid())) = 'admin');

ALTER TABLE trainee_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainee_plans_select_own_or_admin" ON trainee_plans
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR get_user_role((SELECT auth.uid())) = 'admin'
  );
CREATE POLICY "trainee_plans_write_admin" ON trainee_plans
  FOR ALL TO authenticated
  USING (get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (get_user_role((SELECT auth.uid())) = 'admin');

ALTER TABLE enrollment_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollment_agreements_select_admin" ON enrollment_agreements
  FOR SELECT TO authenticated
  USING (get_user_role((SELECT auth.uid())) = 'admin');

ALTER TABLE morning_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "morning_webhook_events_select_admin" ON morning_webhook_events
  FOR SELECT TO authenticated
  USING (get_user_role((SELECT auth.uid())) = 'admin');

-- ---------- column guard ----------
-- Full body repeated: CREATE OR REPLACE replaces the function whole.
CREATE OR REPLACE FUNCTION enforce_profile_column_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF get_user_role(auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role cannot be changed by its owner';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'is_active cannot be changed by its owner';
  END IF;
  IF NEW.nutrition_appointment_status IS DISTINCT FROM OLD.nutrition_appointment_status THEN
    RAISE EXCEPTION 'nutrition_appointment_status cannot be changed by its owner';
  END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'deleted_at cannot be changed by its owner';
  END IF;
  IF NEW.arbox_user_id IS DISTINCT FROM OLD.arbox_user_id THEN
    RAISE EXCEPTION 'arbox_user_id cannot be changed by its owner';
  END IF;
  IF NEW.arbox_paid_training IS DISTINCT FROM OLD.arbox_paid_training THEN
    RAISE EXCEPTION 'arbox_paid_training cannot be changed by its owner';
  END IF;
  IF NEW.arbox_bought_course IS DISTINCT FROM OLD.arbox_bought_course THEN
    RAISE EXCEPTION 'arbox_bought_course cannot be changed by its owner';
  END IF;
  IF NEW.access_override IS DISTINCT FROM OLD.access_override THEN
    RAISE EXCEPTION 'access_override cannot be changed by its owner';
  END IF;
  IF NEW.branches_set_by_admin_at IS DISTINCT FROM OLD.branches_set_by_admin_at THEN
    RAISE EXCEPTION 'branches_set_by_admin_at cannot be changed by its owner';
  END IF;
  -- Who gets billed and what the parent consented to are the parent's
  -- decisions, recorded on the signed agreement; the child cannot move them.
  IF NEW.guardian_name IS DISTINCT FROM OLD.guardian_name THEN
    RAISE EXCEPTION 'guardian_name cannot be changed by its owner';
  END IF;
  IF NEW.guardian_phone IS DISTINCT FROM OLD.guardian_phone THEN
    RAISE EXCEPTION 'guardian_phone cannot be changed by its owner';
  END IF;
  IF NEW.medical_notes IS DISTINCT FROM OLD.medical_notes THEN
    RAISE EXCEPTION 'medical_notes cannot be changed by its owner';
  END IF;
  IF NEW.emergency_contact_name IS DISTINCT FROM OLD.emergency_contact_name THEN
    RAISE EXCEPTION 'emergency_contact_name cannot be changed by its owner';
  END IF;
  IF NEW.emergency_contact_phone IS DISTINCT FROM OLD.emergency_contact_phone THEN
    RAISE EXCEPTION 'emergency_contact_phone cannot be changed by its owner';
  END IF;
  IF NEW.photo_consent IS DISTINCT FROM OLD.photo_consent THEN
    RAISE EXCEPTION 'photo_consent cannot be changed by its owner';
  END IF;

  RETURN NEW;
END;
$$;
```

- [ ] **Step 2: Types**

`src/types/plans.ts`:

```ts
/**
 * קריית אתא signup: catalog, orders, plans, agreements.
 * None of these tables are in the generated Supabase types; reads go through
 * typedFrom() and these interfaces are the source of truth.
 */

export type PlanKind = "subscription" | "session_card" | "term" | "addon";

export interface PlanProduct {
  id: string;
  branch_id: string;
  slug: string;
  name_he: string;
  blurb_he: string | null;
  kind: PlanKind;
  price_ils: number;
  sessions_total: number | null;
  duration_days: number;
  once_per_trainee: boolean;
  gift_he: string | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = "pending" | "paid" | "failed" | "expired";

export interface Order {
  id: string;
  product_id: string;
  branch_id: string;
  status: OrderStatus;
  amount_ils: number;
  currency: string;
  parent_name: string;
  payer_phone: string;
  login_phone: string;
  child_name: string;
  /** ISO YYYY-MM-DD. */
  child_birthdate: string;
  email: string | null;
  profile_id: string | null;
  renewal_of_plan_id: string | null;
  morning_payment_url: string | null;
  morning_transaction_id: string | null;
  morning_document_id: string | null;
  morning_document_url: string | null;
  raw_webhook: unknown | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  fulfillment_error: string | null;
  created_at: string;
  updated_at: string;
}

export type PlanRowStatus = "active" | "cancelled";
export type PlanSource = "online" | "manual";

export interface TraineePlan {
  id: string;
  profile_id: string;
  product_id: string;
  branch_id: string;
  order_id: string | null;
  starts_on: string;
  ends_on: string;
  sessions_total: number | null;
  status: PlanRowStatus;
  source: PlanSource;
  note: string | null;
  reminded_3_days_at: string | null;
  reminded_last_session_at: string | null;
  reminded_expired_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Derived, never stored. */
export type PlanStatus = "active" | "ending_soon" | "expired" | "cancelled";

export const PLAN_STATUS_LABELS_HE: Record<PlanStatus, string> = {
  active: "פעיל",
  ending_soon: "מסתיים בקרוב",
  expired: "פג תוקף",
  cancelled: "בוטל",
};

export interface EnrollmentAgreement {
  id: string;
  order_id: string | null;
  profile_id: string | null;
  agreement_version: string;
  parent_name: string;
  parent_id_number: string;
  parent_phone: string;
  parent_email: string | null;
  child_name: string;
  child_birthdate: string;
  medical_notes: string | null;
  plan_name: string;
  plan_price_ils: number;
  plan_start_on: string;
  payment_method: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  declares_healthy: boolean;
  accepts_terms: boolean;
  authorizes_payment: boolean;
  photo_consent: boolean;
  signature_name: string;
  signed_at: string;
  signed_ip: string | null;
  created_at: string;
}

export interface MorningWebhookEvent {
  delivery_id: string;
  topic: string;
  payload: unknown;
  order_id: string | null;
  received_at: string;
  processed_at: string | null;
  error: string | null;
}
```

In `src/types/database.ts`, add to the `profiles` `Row` block after `branches_set_by_admin_at: string | null;`:

```ts
          guardian_name: string | null;
          guardian_phone: string | null;
          medical_notes: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          photo_consent: boolean | null;
```

and the same six with `?:` to both `Insert` and `Update`. Then add `photo_consent: null, guardian_name: null, guardian_phone: null, medical_notes: null, emergency_contact_name: null, emergency_contact_phone: null,` to the `createProfile` fixture in `src/lib/utils/__tests__/profile.test.ts` (after `branches_set_by_admin_at: null,`).

In `src/types/branches.ts`, add `manager_phone: string | null;` to `Branch` after `order_index`. In `src/lib/branches/__tests__/arbox-branch-match.test.ts`, add `manager_phone: null,` to the `branch()` fixture defaults.

- [ ] **Step 3: Environment**

In `src/lib/env.ts`, add to `requiredServerVars`:

```ts
  "MORNING_CLIENT_ID",
  "MORNING_CLIENT_SECRET",
  "MORNING_WEBHOOK_SECRET",
  "MORNING_ENV",
  "PLAN_RENEWAL_TOKEN_SECRET",
```

and to `optionalServerVars`:

```ts
  "MORNING_DOCUMENT_TYPE",
  "WHATSAPP_PLAN_CONFIRMED_TEMPLATE_NAME",
  "WHATSAPP_PLAN_REMINDER_TEMPLATE_NAME",
```

Append to `.env.local.example`:

```text
# Morning (morning.co) payments. Sandbox keys until a sandbox payment round-trips.
MORNING_ENV=sandbox
MORNING_CLIENT_ID=
MORNING_CLIENT_SECRET=
MORNING_WEBHOOK_SECRET=
# 320 = חשבונית מס/קבלה (עוסק מורשה / חברה), 400 = קבלה (עוסק פטור)
MORNING_DOCUMENT_TYPE=320
# 32+ random bytes, hex. Signs renewal links in WhatsApp reminders.
PLAN_RENEWAL_TOKEN_SECRET=
WHATSAPP_PLAN_CONFIRMED_TEMPLATE_NAME=
WHATSAPP_PLAN_REMINDER_TEMPLATE_NAME=
```

Tell the user (do not do it yourself): add the five required variables to `.env.local` with the sandbox values before running the dev server, otherwise startup validation fails. For `PLAN_RENEWAL_TOKEN_SECRET` run `openssl rand -hex 32`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Apply the migration and verify the seed**

Ask the user before pushing: this adds five tables and seven columns to production. On yes: `supabase db push`.

Verify with the REST count script pattern used in the branches plan:

```bash
node -e '
const fs=require("fs");
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,"").replace(/\\n$/,"")]}));
const url=env.NEXT_PUBLIC_SUPABASE_URL, key=env.SUPABASE_SERVICE_ROLE_KEY;
(async()=>{
 const r=await fetch(url+"/rest/v1/plan_products?select=slug,price_ils,duration_days,sessions_total&order=order_index",{headers:{apikey:key,Authorization:"Bearer "+key}});
 console.log(await r.json());
})();'
```

Expected: seven rows, `monthly` 850/30, `intro_pack` 360/98/4, `card_10` 1250/98/10, `card_20` 2000/196/20, `term_4_months` 3200/120, `addon_monthly` 350/30, `addon_single` 250/30/1.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260911120000_kiryat_ata_signup.sql src/types/plans.ts src/types/database.ts src/types/branches.ts src/lib/env.ts .env.local.example src/lib/utils/__tests__/profile.test.ts src/lib/branches/__tests__/arbox-branch-match.test.ts
git commit -m "feat(signup): catalog, orders, plans, agreements and webhook tables

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Pure rules with tests

**Files:**
- Create: `src/lib/plans/plan-status.ts`, `src/lib/plans/eligibility.ts`, `src/lib/plans/renewal-token.ts`, `src/lib/plans/phone-variants.ts`, `src/lib/validations/israeli-id.ts`, `src/lib/morning/webhook.ts`
- Test: `src/lib/plans/__tests__/plan-status.test.ts`, `src/lib/plans/__tests__/eligibility.test.ts`, `src/lib/plans/__tests__/renewal-token.test.ts`, `src/lib/plans/__tests__/phone-variants.test.ts`, `src/lib/validations/__tests__/israeli-id.test.ts`, `src/lib/morning/__tests__/webhook.test.ts`

**Interfaces:**
- Produces:
  - `resolvePlanStatus(plan: Pick<TraineePlan, "status" | "ends_on" | "sessions_total">, sessionsUsed: number, today: string): PlanStatus`
  - `countSessionsUsedFromRows(rows: readonly { schedule_date: string; branch_id: string | null }[], plan: Pick<TraineePlan, "starts_on" | "ends_on" | "branch_id">, today: string): number`
  - `renewalStartDate(previousEndsOn: string | null, today: string): string`
  - `dueReminderMilestone(plan, sessionsUsed, today): "three_days" | "last_session" | "expired" | null`
  - `isIntroPackEligible(product: Pick<PlanProduct, "once_per_trainee">, priorPaidIntroOrders: number): boolean`
  - `signRenewalToken(planId, expiresAtUnix, secret): string`, `verifyRenewalToken(token, secret, nowUnix): { planId } | null`
  - `phoneVariants(e164: string): string[]`
  - `isValidIsraeliId(value: string): boolean`
  - `verifyMorningSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean`, `extractOrderId(custom: unknown): string | null`, `MorningPaymentReceived`, `MorningDocumentCreated` types

- [ ] **Step 1: Failing tests**

`src/lib/plans/__tests__/plan-status.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  countSessionsUsedFromRows,
  dueReminderMilestone,
  renewalStartDate,
  resolvePlanStatus,
} from "../plan-status";

const timePlan = { status: "active" as const, ends_on: "2026-10-10", sessions_total: null };
const cardPlan = { status: "active" as const, ends_on: "2026-12-31", sessions_total: 10 };

describe("resolvePlanStatus", () => {
  it("is active well before the end", () => {
    expect(resolvePlanStatus(timePlan, 0, "2026-09-20")).toBe("active");
  });
  it("is ending soon within three days of the end, inclusive", () => {
    expect(resolvePlanStatus(timePlan, 0, "2026-10-07")).toBe("ending_soon");
    expect(resolvePlanStatus(timePlan, 0, "2026-10-10")).toBe("ending_soon");
  });
  it("is expired the day after the end", () => {
    expect(resolvePlanStatus(timePlan, 0, "2026-10-11")).toBe("expired");
  });
  it("is ending soon with one session left and expired with none", () => {
    expect(resolvePlanStatus(cardPlan, 9, "2026-09-20")).toBe("ending_soon");
    expect(resolvePlanStatus(cardPlan, 10, "2026-09-20")).toBe("expired");
    expect(resolvePlanStatus(cardPlan, 11, "2026-09-20")).toBe("expired");
  });
  it("cancelled wins over everything", () => {
    expect(resolvePlanStatus({ ...timePlan, status: "cancelled" }, 0, "2026-09-01")).toBe("cancelled");
  });
});

describe("countSessionsUsedFromRows", () => {
  const plan = { starts_on: "2026-09-01", ends_on: "2026-09-30", branch_id: "k" };
  it("counts rows inside the window, in the branch, not after today", () => {
    const rows = [
      { schedule_date: "2026-08-31", branch_id: "k" },
      { schedule_date: "2026-09-01", branch_id: "k" },
      { schedule_date: "2026-09-10", branch_id: "k" },
      { schedule_date: "2026-09-10", branch_id: "h" },
      { schedule_date: "2026-09-15", branch_id: "k" },
      { schedule_date: "2026-10-01", branch_id: "k" },
    ];
    expect(countSessionsUsedFromRows(rows, plan, "2026-09-12")).toBe(2);
  });
  it("counts up to ends_on when today is later", () => {
    const rows = [
      { schedule_date: "2026-09-30", branch_id: "k" },
      { schedule_date: "2026-10-01", branch_id: "k" },
    ];
    expect(countSessionsUsedFromRows(rows, plan, "2026-10-05")).toBe(1);
  });
});

describe("renewalStartDate", () => {
  it("starts today when there is no previous plan or it already ended", () => {
    expect(renewalStartDate(null, "2026-09-10")).toBe("2026-09-10");
    expect(renewalStartDate("2026-09-01", "2026-09-10")).toBe("2026-09-10");
  });
  it("starts the day after a plan that is still running", () => {
    expect(renewalStartDate("2026-09-20", "2026-09-10")).toBe("2026-09-21");
  });
});

describe("dueReminderMilestone", () => {
  const base = {
    status: "active" as const,
    ends_on: "2026-09-20",
    sessions_total: null as number | null,
    reminded_3_days_at: null as string | null,
    reminded_last_session_at: null as string | null,
    reminded_expired_at: null as string | null,
  };
  it("is three_days from three days before the end until the end", () => {
    expect(dueReminderMilestone(base, 0, "2026-09-16")).toBeNull();
    expect(dueReminderMilestone(base, 0, "2026-09-17")).toBe("three_days");
    expect(dueReminderMilestone(base, 0, "2026-09-20")).toBe("three_days");
  });
  it("is expired from the day after the end", () => {
    expect(dueReminderMilestone(base, 0, "2026-09-21")).toBe("expired");
  });
  it("is last_session when one session remains on a card", () => {
    expect(dueReminderMilestone({ ...base, sessions_total: 10 }, 9, "2026-09-01")).toBe("last_session");
    expect(dueReminderMilestone({ ...base, sessions_total: 10 }, 10, "2026-09-01")).toBe("expired");
  });
  it("never repeats a milestone already sent", () => {
    expect(dueReminderMilestone({ ...base, reminded_3_days_at: "x" }, 0, "2026-09-18")).toBeNull();
    expect(dueReminderMilestone({ ...base, reminded_expired_at: "x" }, 0, "2026-09-25")).toBeNull();
  });
  it("is null for cancelled plans", () => {
    expect(dueReminderMilestone({ ...base, status: "cancelled" }, 0, "2026-09-25")).toBeNull();
  });
});
```

`src/lib/plans/__tests__/eligibility.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isIntroPackEligible } from "../eligibility";

describe("isIntroPackEligible", () => {
  it("always allows products that are not once-per-trainee", () => {
    expect(isIntroPackEligible({ once_per_trainee: false }, 5)).toBe(true);
  });
  it("allows the intro pack only when nothing was bought before", () => {
    expect(isIntroPackEligible({ once_per_trainee: true }, 0)).toBe(true);
    expect(isIntroPackEligible({ once_per_trainee: true }, 1)).toBe(false);
  });
});
```

`src/lib/plans/__tests__/renewal-token.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { signRenewalToken, verifyRenewalToken } from "../renewal-token";

const SECRET = "test-secret";
const PLAN = "11111111-1111-4111-8111-111111111111";

describe("renewal token", () => {
  it("round-trips a plan id before expiry", () => {
    const token = signRenewalToken(PLAN, 2_000_000_000, SECRET);
    expect(verifyRenewalToken(token, SECRET, 1_999_999_999)).toEqual({ planId: PLAN });
  });
  it("rejects an expired token", () => {
    const token = signRenewalToken(PLAN, 1_000, SECRET);
    expect(verifyRenewalToken(token, SECRET, 1_001)).toBeNull();
  });
  it("rejects a tampered token and a wrong secret", () => {
    const token = signRenewalToken(PLAN, 2_000_000_000, SECRET);
    expect(verifyRenewalToken(token.slice(0, -2) + "zz", SECRET, 0)).toBeNull();
    expect(verifyRenewalToken(token, "other", 0)).toBeNull();
    expect(verifyRenewalToken("garbage", SECRET, 0)).toBeNull();
  });
});
```

`src/lib/plans/__tests__/phone-variants.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { phoneVariants } from "../phone-variants";

describe("phoneVariants", () => {
  it("returns the E.164, bare, and local spellings", () => {
    expect(phoneVariants("+972501234567")).toEqual([
      "+972501234567",
      "972501234567",
      "0501234567",
    ]);
  });
  it("returns only the input when it is not an Israeli E.164 number", () => {
    expect(phoneVariants("+15551234567")).toEqual(["+15551234567"]);
  });
});
```

`src/lib/validations/__tests__/israeli-id.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isValidIsraeliId } from "../israeli-id";

describe("isValidIsraeliId", () => {
  it("accepts valid ids, including ones that need leading zeros", () => {
    expect(isValidIsraeliId("123456782")).toBe(true);
    expect(isValidIsraeliId("000000018")).toBe(true);
    expect(isValidIsraeliId("18")).toBe(true);
    expect(isValidIsraeliId("12345678 2")).toBe(true);
  });
  it("rejects a wrong check digit, letters, and long inputs", () => {
    expect(isValidIsraeliId("123456781")).toBe(false);
    expect(isValidIsraeliId("12345678a")).toBe(false);
    expect(isValidIsraeliId("1234567890")).toBe(false);
    expect(isValidIsraeliId("")).toBe(false);
  });
});
```

`src/lib/morning/__tests__/webhook.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { extractOrderId, verifyMorningSignature } from "../webhook";

const SECRET = "whsec_test";
const BODY = '{"id":"p1","custom":{"orderId":"o1"}}';
const GOOD = createHmac("sha256", SECRET).update(BODY).digest("hex");

describe("verifyMorningSignature", () => {
  it("accepts the hex HMAC of the raw body", () => {
    expect(verifyMorningSignature(BODY, GOOD, SECRET)).toBe(true);
  });
  it("rejects a missing, wrong-length, or wrong signature", () => {
    expect(verifyMorningSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyMorningSignature(BODY, "abcd", SECRET)).toBe(false);
    expect(verifyMorningSignature(BODY + " ", GOOD, SECRET)).toBe(false);
  });
});

describe("extractOrderId", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  it("reads a plain uuid string", () => {
    expect(extractOrderId(ID)).toBe(ID);
  });
  it("reads orderId or the first uuid-looking value from an object", () => {
    expect(extractOrderId({ orderId: ID })).toBe(ID);
    expect(extractOrderId({ value: ID })).toBe(ID);
    expect(extractOrderId({ a: "x", b: ID })).toBe(ID);
  });
  it("returns null for anything else", () => {
    expect(extractOrderId("not-a-uuid")).toBeNull();
    expect(extractOrderId(null)).toBeNull();
    expect(extractOrderId({ a: 1 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:run -- src/lib/plans src/lib/validations/__tests__/israeli-id.test.ts src/lib/morning`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implementations**

`src/lib/plans/plan-status.ts`:

```ts
import { addDays, daysBetween } from "@/lib/utils/iso-date";
import type { PlanStatus, TraineePlan } from "@/types/plans";

/** How close to the end a plan counts as "ending soon", inclusive. */
export const ENDING_SOON_DAYS = 3;

type StatusInput = Pick<TraineePlan, "status" | "ends_on" | "sessions_total">;

/**
 * The one rule for a plan's state. Every surface calls this with the same
 * roster count and the same "today" (israelToday()), so the dashboard, the
 * roster chip, and the reminder cron cannot disagree.
 */
export function resolvePlanStatus(
  plan: StatusInput,
  sessionsUsed: number,
  today: string,
): PlanStatus {
  if (plan.status === "cancelled") return "cancelled";
  if (today > plan.ends_on) return "expired";

  if (plan.sessions_total !== null) {
    const left = plan.sessions_total - sessionsUsed;
    if (left <= 0) return "expired";
    if (left === 1) return "ending_soon";
  }

  if (daysBetween(today, plan.ends_on) <= ENDING_SOON_DAYS) return "ending_soon";
  return "active";
}

type WindowInput = Pick<TraineePlan, "starts_on" | "ends_on" | "branch_id">;

/**
 * Roster presence counts as a used session: a row for this trainee on a slot
 * in the plan's branch, dated inside the plan window and not after today.
 * Future rosters are plans, not attendance.
 */
export function countSessionsUsedFromRows(
  rows: readonly { schedule_date: string; branch_id: string | null }[],
  plan: WindowInput,
  today: string,
): number {
  const last = today < plan.ends_on ? today : plan.ends_on;
  return rows.filter(
    (row) =>
      row.branch_id === plan.branch_id &&
      row.schedule_date >= plan.starts_on &&
      row.schedule_date <= last,
  ).length;
}

/** A renewal never overlaps: it starts the day after a plan still running. */
export function renewalStartDate(previousEndsOn: string | null, today: string): string {
  if (previousEndsOn === null || previousEndsOn < today) return today;
  return addDays(previousEndsOn, 1);
}

export type ReminderMilestone = "three_days" | "last_session" | "expired";

type ReminderInput = StatusInput &
  Pick<TraineePlan, "reminded_3_days_at" | "reminded_last_session_at" | "reminded_expired_at">;

/**
 * Which reminder is due today and not yet sent, or null. Later milestones win
 * so a plan that slipped past three_days unsent still gets the expired note.
 */
export function dueReminderMilestone(
  plan: ReminderInput,
  sessionsUsed: number,
  today: string,
): ReminderMilestone | null {
  const status = resolvePlanStatus(plan, sessionsUsed, today);
  if (status === "cancelled" || status === "active") return null;

  if (status === "expired") {
    return plan.reminded_expired_at ? null : "expired";
  }

  const sessionsLeft =
    plan.sessions_total === null ? null : plan.sessions_total - sessionsUsed;
  if (sessionsLeft === 1) {
    return plan.reminded_last_session_at ? null : "last_session";
  }
  return plan.reminded_3_days_at ? null : "three_days";
}
```

`src/lib/plans/eligibility.ts`:

```ts
import type { PlanProduct } from "@/types/plans";

/** The intro pack is for new players: one paid order per login phone, ever. */
export function isIntroPackEligible(
  product: Pick<PlanProduct, "once_per_trainee">,
  priorPaidIntroOrders: number,
): boolean {
  if (!product.once_per_trainee) return true;
  return priorPaidIntroOrders === 0;
}
```

`src/lib/plans/renewal-token.ts`:

```ts
import { createHmac, timingSafeEqual } from "crypto";
import { UUID_REGEX } from "@/lib/validations/common";

/**
 * A renewal link must open the form for one plan without a login: the parent
 * is not the account holder. The token is `planId.expiresAt.hmac`, checked in
 * constant time. Thirty days is long enough to survive a slow reply and
 * short enough that a leaked WhatsApp does not stay actionable for a year.
 */
export const RENEWAL_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function mac(planId: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(`${planId}.${expiresAt}`).digest("hex");
}

export function signRenewalToken(planId: string, expiresAtUnix: number, secret: string): string {
  return `${planId}.${expiresAtUnix}.${mac(planId, expiresAtUnix, secret)}`;
}

export function verifyRenewalToken(
  token: string,
  secret: string,
  nowUnix: number,
): { planId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [planId, expiresRaw, signature] = parts;
  if (!UUID_REGEX.test(planId)) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt) || expiresAt <= nowUnix) return null;

  const expected = mac(planId, expiresAt, secret);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"))) {
    return null;
  }
  return { planId };
}
```

`src/lib/plans/phone-variants.ts`:

```ts
/**
 * profiles.phone is stored in three spellings across the table (+972..., 972...,
 * 05...), see the phone-format memory. A lookup by phone must try all three
 * until the canonicalization lands.
 */
export function phoneVariants(e164: string): string[] {
  const match = /^\+972(\d{9})$/.exec(e164);
  if (!match) return [e164];
  const rest = match[1];
  return [e164, `972${rest}`, `0${rest}`];
}
```

`src/lib/validations/israeli-id.ts`:

```ts
/**
 * Israeli ID (תעודת זהות) check digit. Up to nine digits, padded with leading
 * zeros; each digit is multiplied by 1 or 2 alternately, two-digit products
 * are summed to one digit, and the total must divide by ten.
 */
export function isValidIsraeliId(value: string): boolean {
  const digits = value.replace(/\s+/g, "");
  if (!/^\d{1,9}$/.test(digits)) return false;
  const padded = digits.padStart(9, "0");

  const total = [...padded].reduce((sum, char, index) => {
    const product = Number(char) * (index % 2 === 0 ? 1 : 2);
    return sum + (product > 9 ? product - 9 : product);
  }, 0);

  return total % 10 === 0;
}
```

`src/lib/morning/webhook.ts`:

```ts
import { createHmac, timingSafeEqual } from "crypto";
import { UUID_REGEX } from "@/lib/validations/common";

/**
 * Morning signs each webhook delivery with hex HMAC-SHA256 of the raw body
 * under the webhook secret, in the x-webhook-signature header. There is no
 * timestamp in the scheme, so replay protection comes from the delivery id
 * being stored once.
 */
export function verifyMorningSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signatureHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signatureHeader, "utf8"), Buffer.from(expected, "utf8"));
}

/**
 * The `custom` value we sent as a string on the payment form comes back as
 * either a string or an object in webhook payloads. Whatever the shape, the
 * order id is the one uuid inside it.
 */
export function extractOrderId(custom: unknown): string | null {
  if (typeof custom === "string") return UUID_REGEX.test(custom) ? custom : null;
  if (custom && typeof custom === "object") {
    const record = custom as Record<string, unknown>;
    const preferred = record.orderId ?? record.value;
    if (typeof preferred === "string" && UUID_REGEX.test(preferred)) return preferred;
    for (const value of Object.values(record)) {
      if (typeof value === "string" && UUID_REGEX.test(value)) return value;
    }
  }
  return null;
}

export interface MorningPaymentReceived {
  id?: string;
  description?: string;
  total?: number;
  custom?: unknown;
  payer?: { name?: string; phone?: string; email?: string };
  transactions?: {
    id?: string;
    total?: number;
    gateway?: string;
    gatewayTransactionId?: string;
    paymentMethod?: { type?: string; cardNumber?: string };
  }[];
}

export interface MorningDocumentCreated {
  id?: string;
  type?: number;
  number?: string;
  custom?: unknown;
  transactionId?: string;
  files?: { downloadLinks?: { he?: string; en?: string; origin?: string } };
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:run -- src/lib/plans src/lib/validations/__tests__/israeli-id.test.ts src/lib/morning`
Expected: PASS, 6 files.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plans src/lib/validations/israeli-id.ts src/lib/validations/__tests__/israeli-id.test.ts src/lib/morning
git commit -m "feat(signup): plan status, eligibility, renewal token, id check, webhook verify

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Morning client

**Files:**
- Create: `src/lib/morning/config.ts`, `src/lib/morning/auth.ts`, `src/lib/morning/client.ts`

**Interfaces:**
- Produces: `getMorningConfig(): { apiBase; tokenBase; clientId; clientSecret; webhookSecret; documentType: number }`, `getMorningAccessToken(): Promise<string>`, `createPaymentForm(input: PaymentFormInput): Promise<{ url: string } | { error: string }>`

- [ ] **Step 1: Config**

`src/lib/morning/config.ts`:

```ts
import "server-only";

const HOSTS = {
  sandbox: {
    apiBase: "https://sandbox.d.greeninvoice.co.il/api/v1",
    tokenBase: "https://api.sandbox.morning.dev",
  },
  production: {
    apiBase: "https://api.greeninvoice.co.il/api/v1",
    tokenBase: "https://api.morning.co",
  },
} as const;

/** 320 = חשבונית מס/קבלה. The env var overrides for an עוסק פטור (400). */
const DEFAULT_DOCUMENT_TYPE = 320;

export interface MorningConfig {
  apiBase: string;
  tokenBase: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  documentType: number;
}

export function getMorningConfig(): MorningConfig {
  const env = process.env.MORNING_ENV === "production" ? "production" : "sandbox";
  const clientId = process.env.MORNING_CLIENT_ID?.trim();
  const clientSecret = process.env.MORNING_CLIENT_SECRET?.trim();
  const webhookSecret = process.env.MORNING_WEBHOOK_SECRET?.trim();
  if (!clientId || !clientSecret || !webhookSecret) {
    throw new Error("Morning environment variables are not configured");
  }
  const documentType = Number(process.env.MORNING_DOCUMENT_TYPE ?? DEFAULT_DOCUMENT_TYPE);
  return { ...HOSTS[env], clientId, clientSecret, webhookSecret, documentType };
}
```

- [ ] **Step 2: Token cache**

`src/lib/morning/auth.ts`:

```ts
import "server-only";

import { getMorningConfig } from "./config";

interface CachedToken {
  accessToken: string;
  /** Unix seconds. */
  expiresAt: number;
}

/** Refresh a minute early so a request never carries a token about to die. */
const REFRESH_MARGIN_SECONDS = 60;

let cached: CachedToken | null = null;

/**
 * Morning issues a one-hour bearer token for client credentials. Fluid
 * Compute keeps a module instance warm across requests, so caching in the
 * module saves a token call per request; a cold instance just fetches one.
 */
export async function getMorningAccessToken(forceRefresh = false): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (!forceRefresh && cached && cached.expiresAt - REFRESH_MARGIN_SECONDS > now) {
    return cached.accessToken;
  }

  const { tokenBase, clientId, clientSecret } = getMorningConfig();
  const response = await fetch(`${tokenBase}/idp/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Morning token request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as { accessToken?: string; expiresAt?: number };
  if (!data.accessToken || !data.expiresAt) {
    throw new Error("Morning token response is missing accessToken or expiresAt");
  }

  cached = { accessToken: data.accessToken, expiresAt: data.expiresAt };
  return cached.accessToken;
}
```

- [ ] **Step 3: Payment form**

`src/lib/morning/client.ts`:

```ts
import "server-only";

import { getMorningAccessToken } from "./auth";
import { getMorningConfig } from "./config";

export interface PaymentFormInput {
  /** Our order id; echoed back as `custom`. */
  orderId: string;
  description: string;
  amountIls: number;
  client: {
    name: string;
    mobile: string;
    email: string | null;
  };
  successUrl: string;
  failureUrl: string;
  notifyUrl: string;
}

type PaymentFormResult = { url: string } | { error: string };

const REQUEST_TIMEOUT_MS = 30_000;

async function postPaymentForm(
  token: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const { apiBase } = getMorningConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${apiBase}/payments/form`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Creates a hosted payment page. Morning creates the document itself when the
 * customer pays and emails it to the client emails. One retry on a 401 with a
 * fresh token, none on other 4xx: those are our bug, not transient.
 */
export async function createPaymentForm(input: PaymentFormInput): Promise<PaymentFormResult> {
  const { documentType } = getMorningConfig();
  const body = {
    description: input.description,
    type: documentType,
    lang: "he",
    currency: "ILS",
    vatType: 0,
    amount: input.amountIls,
    maxPayments: 1,
    client: {
      name: input.client.name,
      mobile: input.client.mobile,
      emails: input.client.email ? [input.client.email] : [],
      add: true,
    },
    income: [
      {
        description: input.description,
        quantity: 1,
        price: input.amountIls,
        currency: "ILS",
        vatType: 0,
      },
    ],
    successUrl: input.successUrl,
    failureUrl: input.failureUrl,
    notifyUrl: input.notifyUrl,
    custom: input.orderId,
  };

  try {
    let response = await postPaymentForm(await getMorningAccessToken(), body);
    if (response.status === 401) {
      response = await postPaymentForm(await getMorningAccessToken(true), body);
    }

    const text = await response.text();
    if (!response.ok) {
      console.error(`[Morning] payments/form ${response.status}:`, text.slice(0, 500));
      return { error: "שגיאה ביצירת עמוד התשלום" };
    }

    const data = JSON.parse(text) as { errorCode?: number; errorDescription?: string; url?: string };
    if (data.errorCode && data.errorCode !== 0) {
      console.error("[Morning] payments/form error:", data.errorCode, data.errorDescription);
      return { error: "שגיאה ביצירת עמוד התשלום" };
    }
    if (!data.url) return { error: "שגיאה ביצירת עמוד התשלום" };
    return { url: data.url };
  } catch (error) {
    console.error("[Morning] payments/form request failed:", error);
    return { error: "שגיאה ביצירת עמוד התשלום" };
  }
}
```

- [ ] **Step 4: Type-check, lint, commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add src/lib/morning
git commit -m "feat(signup): Morning client with token cache and payment form

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Content modules with a test

**Files:**
- Create: `content/terms-kiryat-ata.ts`, `content/safety-protocol.ts`
- Test: `content/__tests__/terms.test.ts`
- Modify: `tsconfig.json` and `vitest.config.ts` only if `content/` is outside the include paths (check with `npx tsc --noEmit` after creating the files; if `content/` is not compiled, add `"content/**/*.ts"` to tsconfig `include` and `content/**/*.{test,spec}.ts` to the vitest `include`).

**Interfaces:**
- Produces: `TERMS_VERSION: string`, `TERMS_SECTIONS: readonly { title: string; items: readonly string[] }[]`, `SAFETY_SECTIONS`, `EMERGENCY_NUMBERS`.

- [ ] **Step 1: Failing test**

`content/__tests__/terms.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TERMS_SECTIONS, TERMS_VERSION } from "../terms-kiryat-ata";
import { EMERGENCY_NUMBERS, SAFETY_SECTIONS } from "../safety-protocol";

describe("terms content", () => {
  it("has a version string in YYYY-MM form with an optional suffix", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}(-[a-z]+)?$/);
  });
  it("has sections with titles and at least one item each", () => {
    expect(TERMS_SECTIONS.length).toBeGreaterThan(0);
    for (const section of TERMS_SECTIONS) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.items.length).toBeGreaterThan(0);
    }
  });
});

describe("safety protocol content", () => {
  it("has the seven sections of the PDF and the three emergency numbers", () => {
    expect(SAFETY_SECTIONS).toHaveLength(7);
    expect(EMERGENCY_NUMBERS.map((n) => n.number)).toEqual(["101", "100", "102"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:run -- content`
Expected: FAIL, modules not found (or "no test files" if `content/` is outside the vitest include; fix the include first, then rerun).

- [ ] **Step 3: Terms content**

`content/terms-kiryat-ata.ts`. The owner has not delivered the final תקנון yet; this is a draft built from the price sheet and the landing page footnote, marked as a draft in its version so the agreement records that. Replace the text when the owner sends theirs and bump the version.

```ts
/**
 * תקנון סניף קריית אתא.
 *
 * The version string is stored on every signed agreement, so changing the
 * text means bumping it. "-draft" marks text the owner has not approved yet.
 */
export const TERMS_VERSION = "2026-09-draft";

export interface TermsSection {
  title: string;
  items: readonly string[];
}

export const TERMS_SECTIONS: readonly TermsSection[] = [
  {
    title: "המסלולים",
    items: [
      "מנוי חודשי: 2 אימונים בשבוע, בתוקף 30 יום מיום הרכישה.",
      "חבילת היכרות: 4 מפגשים, לשחקן חדש בלבד, פעם אחת.",
      "כרטיסיית 10 אימונים בתוקף 14 שבועות; כרטיסיית 20 אימונים בתוקף 28 שבועות.",
      "מסלול מתקדמים: 4 חודשים, 2 אימונים בשבוע, בתוקף 120 יום.",
      "אימון נספר כאשר החניך משובץ ללוח האימונים של אותו יום.",
    ],
  },
  {
    title: "תשלום וחידוש",
    items: [
      "התשלום מתבצע מראש בכרטיס אשראי דרך עמוד תשלום מאובטח של Morning.",
      "חשבונית או קבלה נשלחת לכתובת הדוא\"ל שנמסרה בהרשמה.",
      "המנוי אינו מתחדש אוטומטית. לפני סיום המסלול נשלחת תזכורת בוואטסאפ עם קישור לחידוש.",
    ],
  },
  {
    title: "ביטולים והחזרים",
    items: [
      "ביטול מסלול בהודעה בכתב לפחות 7 ימי עסקים לפני מועד האימון הבא.",
      "החזר יינתן בהתאם לחוק הגנת הצרכן ובניכוי האימונים שנוצלו.",
      "אימון שלא נוצל במסגרת תוקף המסלול אינו ניתן להעברה או להחזר.",
    ],
  },
  {
    title: "בריאות ובטיחות",
    items: [
      "ההורה מצהיר כי החניך כשיר לפעילות גופנית וכי מסר כל מידע רפואי רלוונטי.",
      "צוות האקדמיה פועל לפי נוהל בטיחות וחירום. במקרה חירום יוזעקו שירותי ההצלה ויידע ההורה מיד.",
    ],
  },
  {
    title: "צילום",
    items: [
      "במהלך האימונים עשויים להיערך צילומים לצורכי שיתוף ברשתות החברתיות של המועדון. ההסכמה לצילום נתונה לבחירת ההורה בטופס ההרשמה.",
    ],
  },
];
```

- [ ] **Step 4: Safety protocol content**

`content/safety-protocol.ts`, transcribed from the PDF:

```ts
/** נוהל בטיחות וחירום, an internal document for the coaching staff. */

export interface EmergencyNumber {
  label: string;
  number: string;
}

export const EMERGENCY_NUMBERS: readonly EmergencyNumber[] = [
  { label: "מד\"א", number: "101" },
  { label: "משטרה", number: "100" },
  { label: "כבאות", number: "102" },
];

export interface SafetySection {
  title: string;
  subtitle: string;
  items: readonly string[];
}

export const SAFETY_SECTIONS: readonly SafetySection[] = [
  {
    title: "לפני כל אימון",
    subtitle: "בדיקות מוקדמות ומניעה",
    items: [
      "בדיקת תקינות המגרש: רשתות, שערים, קונוסים",
      "ערכת עזרה ראשונה זמינה ונגישה בצד המגרש",
      "בדיקת תנאי מזג אוויר (חום, ברקים, גשם)",
      "וידוא זמינות מים וצל למתאמנים",
      "ספירת מתאמנים ורישום נוכחות",
      "וידוא כי כל מתאמן מילא הצהרת בריאות עדכנית",
    ],
  },
  {
    title: "חימום ומניעת פציעות",
    subtitle: "שגרת פתיחה וסיום מובנית",
    items: [
      "חימום דינמי של כ-10 דקות לפני כל אימון",
      "מתיחות מובנות בסיום האימון",
      "התאמת עומס האימון לגיל ולרמת הכושר",
      "הפסקות מים קבועות כל 15-20 דקות",
      "מעקב אחר סימני עייפות או מצוקה של מתאמנים",
      "שימוש נכון בציוד: ללא קונוסים או ציוד פזור בשטח המשחק",
    ],
  },
  {
    title: "פציעה קלה",
    subtitle: "שפשופים, נקעים קלים, חבלות משטחיות",
    items: [
      "הפסקת השתתפות המתאמן באימון עד להערכה",
      "טיפול ראשוני במקום: ניקוי, קירור, חבישה",
      "מעקב אחר המתאמן עד סיום האימון",
      "דיווח מיידי להורה בסיום האימון",
      "תיעוד קצר ביומן האירועים של המועדון",
    ],
  },
  {
    title: "פציעה חמורה / חירום רפואי",
    subtitle: "חבלת ראש, שבר, איבוד הכרה, קושי נשימה",
    items: [
      "עצירה מיידית של האימון כולו",
      "המאמן הראשי מטפל בנפגע. אין להזיז אותו ללא צורך",
      "מאמן או עוזר שני מרחיק ומרגיע את שאר הקבוצה",
      "התקשרות מיידית למד\"א (101) בכל ספק",
      "התקשרות מיידית להורה או לאפוטרופוס באותם רגעים",
      "פינוי מבוקר אך ורק לפי הנחיית צוות רפואי",
    ],
  },
  {
    title: "מזג אוויר קיצוני",
    subtitle: "קבלת החלטות בשטח",
    items: [
      "חום קיצוני: קיצור או ביטול אימון, הפסקות מים תכופות בצל",
      "ברקים או סופה: פינוי מיידי ממגרש למבנה סגור",
      "גשם כבד: שיקול דעת המאמן, עדיפות לביטול על פני סיכון",
      "איכות אוויר ירודה: הפחתת עצימות האימון או ביטול",
    ],
  },
  {
    title: "אחריות ותפקידים",
    subtitle: "מי עושה מה בזמן אירוע",
    items: [
      "מאמן ראשי: מוביל את הטיפול הרפואי הראשוני ומקבל את ההחלטות בשטח",
      "מאמן משנה או עוזר: אחראי על יצירת קשר עם ההורים ושירותי החירום, ומרחיק את שאר הקבוצה",
      "מנהל המתחם: מקבל דיווח מלא על כל אירוע בטיחותי תוך 24 שעות",
    ],
  },
  {
    title: "דיווח לאחר אירוע",
    subtitle: "תיעוד וסגירת מעגל",
    items: [
      "מילוי טופס דיווח אירוע תוך 24 שעות מקרות האירוע",
      "תיעוד שם המתאמן, שעה, תיאור האירוע והטיפול שניתן",
      "שמירת התיעוד בתיק המועדון לצורך מעקב וביטוח",
      "עדכון ההורים בכתב (וואטסאפ או מייל) על סיכום האירוע",
    ],
  },
];
```

- [ ] **Step 5: Run tests, type-check, commit**

Run: `npm run test:run -- content && npx tsc --noEmit`
Expected: PASS and 0 errors. If `tsc` ignores `content/`, add `"content/**/*.ts"` to `tsconfig.json` `include` and `"content/**/*.{test,spec}.{ts,tsx}"` to the vitest `include` array, then rerun.

```bash
git add content tsconfig.json vitest.config.ts
git commit -m "feat(signup): draft terms and the safety protocol as typed content

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Catalog page and the agreement form

**Files:**
- Create: `src/lib/validations/enrollment.ts`
- Create: `src/features/enrollment/lib/catalog.ts`
- Create: `src/features/enrollment/components/PlanCatalog.tsx`, `EnrollmentForm.tsx`, `TermsSheet.tsx`
- Create: `src/app/join/layout.tsx`, `src/app/join/page.tsx`, `src/app/join/terms/page.tsx`
- Test: `src/lib/validations/__tests__/enrollment.test.ts`

**Interfaces:**
- Produces: `enrollmentSchema`, `EnrollmentInput` (the form and the checkout action share it); `loadKiryatAtaCatalog(): Promise<PlanProduct[]>`; `EnrollmentForm` props `{ product: PlanProduct; prefill?: Partial<EnrollmentInput>; renewalToken?: string; onSubmit: (input: EnrollmentInput) => Promise<{ error?: string }> }`.

- [ ] **Step 1: Failing schema test**

`src/lib/validations/__tests__/enrollment.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { enrollmentSchema } from "../enrollment";

const valid = {
  productId: "11111111-1111-4111-8111-111111111111",
  parentName: "דנה כהן",
  parentIdNumber: "123456782",
  payerPhone: "0501234567",
  loginPhone: "0521234567",
  email: "dana@example.com",
  childName: "יובל כהן",
  childBirthdate: "2015-04-03",
  medicalNotes: "",
  emergencyContactName: "רון כהן",
  emergencyContactPhone: "0531234567",
  declaresHealthy: true,
  acceptsTerms: true,
  authorizesPayment: true,
  photoConsent: "yes",
  signatureName: " דנה כהן ",
};

describe("enrollmentSchema", () => {
  it("accepts a complete form and normalizes phones and the signature", () => {
    const result = enrollmentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.payerPhone).toBe("+972501234567");
    expect(result.data.loginPhone).toBe("+972521234567");
    expect(result.data.signatureName).toBe("דנה כהן");
    expect(result.data.photoConsent).toBe(true);
    expect(result.data.email).toBe("dana@example.com");
    expect(result.data.medicalNotes).toBeNull();
  });
  it("requires each declaration", () => {
    expect(enrollmentSchema.safeParse({ ...valid, declaresHealthy: false }).success).toBe(false);
    expect(enrollmentSchema.safeParse({ ...valid, acceptsTerms: false }).success).toBe(false);
    expect(enrollmentSchema.safeParse({ ...valid, authorizesPayment: false }).success).toBe(false);
  });
  it("requires the signature to match the parent name", () => {
    expect(enrollmentSchema.safeParse({ ...valid, signatureName: "מישהו אחר" }).success).toBe(false);
  });
  it("rejects a bad id number and accepts photo consent no", () => {
    expect(enrollmentSchema.safeParse({ ...valid, parentIdNumber: "123456781" }).success).toBe(false);
    const no = enrollmentSchema.safeParse({ ...valid, photoConsent: "no" });
    expect(no.success && no.data.photoConsent === false).toBe(true);
  });
  it("allows an empty email", () => {
    const result = enrollmentSchema.safeParse({ ...valid, email: "" });
    expect(result.success && result.data.email === null).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:run -- src/lib/validations/__tests__/enrollment.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Schema**

`src/lib/validations/enrollment.ts`:

```ts
import { z } from "zod";
import { PHONE_REGEX_IL, UUID_REGEX, formatPhoneToInternational } from "@/lib/validations/common";
import { isValidIsraeliId } from "@/lib/validations/israeli-id";

const phoneField = z
  .string()
  .trim()
  .regex(PHONE_REGEX_IL, "מספר טלפון לא תקין (פורמט: 0501234567)")
  .transform(formatPhoneToInternational);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `הטקסט ארוך מדי (מקסימום ${max} תווים)`)
    .transform((v) => (v === "" ? null : v));

const mustBeTrue = (message: string) =>
  z.boolean().refine((v) => v === true, { message });

/**
 * The enrollment agreement as a form. Mirrors the paper הסכם התקשרות והרשמה
 * block by block; the server action stores the parsed output on the order and
 * on enrollment_agreements.
 */
export const enrollmentSchema = z
  .object({
    productId: z.string().regex(UUID_REGEX, "מסלול לא תקין"),
    renewalToken: z.string().max(200).optional(),

    parentName: z.string().trim().min(2, "נדרש שם ההורה").max(100, "שם ארוך מדי"),
    parentIdNumber: z
      .string()
      .trim()
      .refine(isValidIsraeliId, "מספר תעודת זהות לא תקין"),
    payerPhone: phoneField,
    loginPhone: phoneField,
    email: z
      .string()
      .trim()
      .email("כתובת דוא\"ל לא תקינה")
      .or(z.literal(""))
      .transform((v) => (v === "" ? null : v)),

    childName: z.string().trim().min(2, "נדרש שם החניך").max(100, "שם ארוך מדי"),
    childBirthdate: z
      .string()
      .refine((date) => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return false;
        const age = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 4 && age <= 25;
      }, "תאריך לידה לא תקין (גיל 4-25)"),
    medicalNotes: optionalText(500),

    emergencyContactName: z.string().trim().min(2, "נדרש שם איש קשר לחירום").max(100),
    emergencyContactPhone: phoneField,

    declaresHealthy: mustBeTrue("יש לאשר את הצהרת הבריאות"),
    acceptsTerms: mustBeTrue("יש לאשר את קריאת התקנון"),
    authorizesPayment: mustBeTrue("יש לאשר את הסמכת התשלום"),
    photoConsent: z.enum(["yes", "no"], { message: "יש לבחור לגבי צילום" }).transform((v) => v === "yes"),

    signatureName: z.string().trim().min(2, "נדרשת חתימה").max(100),
  })
  .refine((v) => v.signatureName === v.parentName, {
    message: "החתימה חייבת להיות זהה לשם ההורה",
    path: ["signatureName"],
  });

export type EnrollmentInput = z.input<typeof enrollmentSchema>;
export type EnrollmentData = z.output<typeof enrollmentSchema>;
```

- [ ] **Step 4: Run the schema test**

Run: `npm run test:run -- src/lib/validations/__tests__/enrollment.test.ts`
Expected: PASS.

- [ ] **Step 5: Catalog loader**

`src/features/enrollment/lib/catalog.ts`:

```ts
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import type { PlanProduct } from "@/types/plans";

export const KIRYAT_ATA_BRANCH_NAME = "קריית אתא";

/** The active קריית אתא products, in display order. Empty on any failure. */
export async function loadKiryatAtaCatalog(): Promise<PlanProduct[]> {
  const db = createAdminClient();
  const { data: branch } = (await typedFrom(db, "branches")
    .select("id")
    .eq("name_he", KIRYAT_ATA_BRANCH_NAME)
    .maybeSingle()) as { data: { id: string } | null };
  if (!branch) return [];

  const { data, error } = (await typedFrom(db, "plan_products")
    .select("*")
    .eq("branch_id", branch.id)
    .eq("is_active", true)
    .order("order_index")) as { data: PlanProduct[] | null; error: { message: string } | null };

  if (error) {
    console.error("loadKiryatAtaCatalog error:", error);
    return [];
  }
  return (data ?? []).map((row) => ({ ...row, price_ils: Number(row.price_ils) }));
}

export async function loadProductById(productId: string): Promise<PlanProduct | null> {
  const { data } = (await typedFrom(createAdminClient(), "plan_products")
    .select("*")
    .eq("id", productId)
    .maybeSingle()) as { data: PlanProduct | null };
  return data ? { ...data, price_ils: Number(data.price_ils) } : null;
}
```

The admin client is used for reads on a public page because the `/join` route renders on the server with no session; the catalog policy allows anon reads too, so switching to the anon client later is a one-line change.

- [ ] **Step 6: Catalog cards**

`src/features/enrollment/components/PlanCatalog.tsx`:

```tsx
"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanProduct } from "@/types/plans";

interface PlanCatalogProps {
  products: PlanProduct[];
  selectedId: string | null;
  onSelect: (product: PlanProduct) => void;
}

function periodLabel(product: PlanProduct): string {
  if (product.sessions_total !== null) {
    const weeks = Math.round(product.duration_days / 7);
    return `${product.sessions_total} אימונים, בתוקף ${weeks} שבועות`;
  }
  if (product.duration_days === 30) return "לחודש";
  return `ל-${Math.round(product.duration_days / 30)} חודשים`;
}

export function PlanCatalog({ products, selectedId, onSelect }: PlanCatalogProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const selected = product.id === selectedId;
        return (
          <button
            key={product.id}
            type="button"
            onClick={() => onSelect(product)}
            aria-pressed={selected}
            className={cn(
              "flex h-full flex-col rounded-3xl border bg-white p-6 text-start transition-all",
              selected
                ? "border-2 border-[#CDEA68] shadow-lg"
                : "border-black/10 hover:border-black/20 hover:shadow-md",
            )}
          >
            <h3 className="text-lg font-bold text-black">{product.name_he}</h3>
            {product.blurb_he && (
              <p className="mt-1 text-sm text-black/50">{product.blurb_he}</p>
            )}
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-black">
                ₪{product.price_ils.toLocaleString("he-IL")}
              </span>
              <span className="text-sm text-black/40">{periodLabel(product)}</span>
            </div>
            {product.gift_he && (
              <p className="mt-3 rounded-xl bg-[#CDEA68]/30 px-3 py-2 text-xs text-black/70">
                {product.gift_he}
              </p>
            )}
            <div className="mt-auto pt-5">
              <Button
                type="button"
                variant={selected ? "default" : "outline"}
                className="w-full"
                tabIndex={-1}
              >
                {selected ? <Check className="h-4 w-4 me-2" /> : null}
                {selected ? "נבחר" : "בחירה"}
              </Button>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7: Terms sheet**

`src/features/enrollment/components/TermsSheet.tsx`:

```tsx
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TERMS_SECTIONS, TERMS_VERSION } from "../../../../content/terms-kiryat-ata";

export function TermsBody() {
  return (
    <div className="space-y-6 text-sm leading-6">
      {TERMS_SECTIONS.map((section) => (
        <section key={section.title}>
          <h3 className="mb-2 font-bold">{section.title}</h3>
          <ul className="list-disc space-y-1 ps-5">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">גרסה {TERMS_VERSION}</p>
    </div>
  );
}

/** The תקנון, opened from the declaration checkbox without leaving the form. */
export function TermsSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button type="button" className="underline underline-offset-2">
          תקנון גארדן אוף עדן
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle>תקנון סניף קריית אתא</SheetTitle>
        </SheetHeader>
        <div className="py-4">
          <TermsBody />
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

Check the exact export names in `src/components/ui/sheet.tsx` (`grep -n "^export\|^  Sheet" src/components/ui/sheet.tsx`) and adjust the import list if `SheetTrigger` or `SheetHeader` are named differently. If `content/` is not resolvable with the relative path, add `"@content/*": ["./content/*"]` to `tsconfig.json` `paths` and import from `@content/terms-kiryat-ata`.

- [ ] **Step 8: The form**

`src/features/enrollment/components/EnrollmentForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { enrollmentSchema, type EnrollmentInput } from "@/lib/validations/enrollment";
import type { PlanProduct } from "@/types/plans";
import { TermsSheet } from "./TermsSheet";

interface EnrollmentFormProps {
  product: PlanProduct;
  prefill?: Partial<EnrollmentInput>;
  renewalToken?: string;
  onSubmit: (input: EnrollmentInput) => Promise<{ error?: string }>;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="border-s-4 border-[#CDEA68] ps-3 text-lg font-bold">{children}</h2>
  );
}

function DeclarationField({
  control,
  name,
  children,
}: {
  control: ReturnType<typeof useForm<EnrollmentInput>>["control"];
  name: "declaresHealthy" | "acceptsTerms" | "authorizesPayment";
  children: React.ReactNode;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-row items-start gap-3 space-y-0">
          <FormControl>
            <Checkbox
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          </FormControl>
          <div className="space-y-1 leading-snug">
            <FormLabel className="font-normal">{children}</FormLabel>
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
}

export function EnrollmentForm({ product, prefill, renewalToken, onSubmit }: EnrollmentFormProps) {
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<EnrollmentInput>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: {
      productId: product.id,
      renewalToken,
      parentName: "",
      parentIdNumber: "",
      payerPhone: "",
      loginPhone: "",
      email: "",
      childName: "",
      childBirthdate: "",
      medicalNotes: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      declaresHealthy: false,
      acceptsTerms: false,
      authorizesPayment: false,
      photoConsent: undefined,
      signatureName: "",
      ...prefill,
    },
  });

  const submit = async (input: EnrollmentInput) => {
    setLoading(true);
    try {
      const result = await onSubmit(input);
      if (result.error) {
        toast.error(result.error);
        setLoading(false);
      }
      // On success the action redirects to Morning; nothing to do here.
    } catch {
      toast.error("שגיאה בשליחת הטופס. נסו שוב.");
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-8">
        <section className="space-y-4">
          <SectionTitle>פרטי ההורה / האפוטרופוס</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="parentName" render={({ field }) => (
              <FormItem>
                <FormLabel>שם מלא</FormLabel>
                <FormControl><Input {...field} disabled={loading} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="parentIdNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>מספר ת.ז</FormLabel>
                <FormControl><Input {...field} inputMode="numeric" dir="ltr" className="text-right" disabled={loading} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="payerPhone" render={({ field }) => (
              <FormItem>
                <FormLabel>טלפון נייד (לתשלום ולקבלה)</FormLabel>
                <FormControl><Input {...field} inputMode="tel" dir="ltr" className="text-right" placeholder="0501234567" disabled={loading} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="loginPhone" render={({ field }) => (
              <FormItem>
                <FormLabel>טלפון וואטסאפ של החניך (להתחברות לאפליקציה)</FormLabel>
                <FormControl><Input {...field} inputMode="tel" dir="ltr" className="text-right" placeholder="0521234567" disabled={loading} /></FormControl>
                <FormDescription>קוד ההתחברות נשלח למספר הזה בוואטסאפ</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>דוא"ל (לקבלת החשבונית)</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} type="email" dir="ltr" className="text-right" disabled={loading} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>פרטי החניך/ה</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="childName" render={({ field }) => (
              <FormItem>
                <FormLabel>שם מלא</FormLabel>
                <FormControl><Input {...field} disabled={loading} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="childBirthdate" render={({ field }) => (
              <FormItem>
                <FormLabel>תאריך לידה</FormLabel>
                <FormControl><Input {...field} type="date" max={today} disabled={loading} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="medicalNotes" render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>אלרגיות / מגבלות רפואיות ידועות (אם קיימות)</FormLabel>
                <FormControl><Textarea {...field} value={field.value ?? ""} rows={2} disabled={loading} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>פרטי המסלול הנרכש</SectionTitle>
          <dl className="grid gap-2 rounded-2xl border bg-muted/30 p-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">סוג מסלול</dt><dd className="font-medium">{product.name_he}</dd></div>
            <div><dt className="text-muted-foreground">עלות</dt><dd className="font-medium">₪{product.price_ils.toLocaleString("he-IL")}</dd></div>
            <div><dt className="text-muted-foreground">תאריך תחילה</dt><dd className="font-medium">{today.split("-").reverse().join("/")}</dd></div>
            <div><dt className="text-muted-foreground">אמצעי תשלום</dt><dd className="font-medium">כרטיס אשראי</dd></div>
          </dl>
        </section>

        <section className="space-y-4">
          <SectionTitle>איש קשר נוסף למקרה חירום</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="emergencyContactName" render={({ field }) => (
              <FormItem>
                <FormLabel>שם מלא</FormLabel>
                <FormControl><Input {...field} disabled={loading} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="emergencyContactPhone" render={({ field }) => (
              <FormItem>
                <FormLabel>טלפון</FormLabel>
                <FormControl><Input {...field} inputMode="tel" dir="ltr" className="text-right" disabled={loading} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>הצהרות ואישורים</SectionTitle>
          <div className="space-y-4 rounded-2xl border p-4">
            <DeclarationField control={form.control} name="declaresHealthy">
              אני מצהיר/ה כי החניך/ה כשיר/ה מבחינה בריאותית להשתתף בפעילות גופנית, ואין מניעה רפואית ידועה מלבד המפורט לעיל.
            </DeclarationField>
            <DeclarationField control={form.control} name="acceptsTerms">
              <span>
                אני מאשר/ת כי קראתי את <TermsSheet /> במלואו, הבנתי את תנאיו, לרבות מדיניות ביטולים, החזרים וחיוב, ואני מסכים/ה להם.
              </span>
            </DeclarationField>
            <DeclarationField control={form.control} name="authorizesPayment">
              אני מסמיך/ה את גארדן אוף עדן לחייב את אמצעי התשלום שנמסר בהתאם למסלול שנבחר, כמפורט בתקנון.
            </DeclarationField>

            <FormField control={form.control} name="photoConsent" render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="font-normal">
                  ידוע לי כי במהלך האימונים עשויים להיות צילומים לצורכי שיתוף ברשתות החברתיות של המועדון.
                </FormLabel>
                <div className="flex gap-6">
                  {(["yes", "no"] as const).map((option) => (
                    <div key={option} className="flex items-center gap-2">
                      <Checkbox
                        id={`photo-${option}`}
                        checked={field.value === option}
                        onCheckedChange={(checked) => field.onChange(checked === true ? option : undefined)}
                        disabled={loading}
                      />
                      <Label htmlFor={`photo-${option}`} className="cursor-pointer">
                        {option === "yes" ? "מאשר/ת צילום" : "לא מעוניין/ת בצילום"}
                      </Label>
                    </div>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border-2 border-[#CDEA68] bg-[#CDEA68]/10 p-4 text-sm font-medium">
            בחתימתי מטה אני מאשר/ת כי כל הפרטים שמסרתי נכונים, וכי אני מקבל/ת על עצמי את תנאי הסכם זה ואת תקנון גארדן אוף עדן במלואם.
          </div>
          <FormField control={form.control} name="signatureName" render={({ field }) => (
            <FormItem>
              <FormLabel>שם ההורה כחתימה</FormLabel>
              <FormControl><Input {...field} placeholder="הקלידו את שמכם המלא" disabled={loading} /></FormControl>
              <FormDescription>הקלדת השם מהווה חתימה דיגיטלית על ההסכם</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
        </section>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
          {loading ? "מעבירים לתשלום..." : `לתשלום ₪${product.price_ils.toLocaleString("he-IL")}`}
        </Button>
      </form>
    </Form>
  );
}
```

- [ ] **Step 9: Pages**

`src/app/join/layout.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הרשמה לסניף קריית אתא | Garden of Eden",
  description: "בחירת מסלול אימונים, חתימה על הסכם ההרשמה ותשלום מאובטח.",
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F5F5F0] py-10">
      <div className="container mx-auto max-w-5xl px-4">{children}</div>
    </main>
  );
}
```

`src/app/join/page.tsx` (server component that hands the catalog to a client island; the island owns the selected product and calls the action from Task 6):

```tsx
import { loadKiryatAtaCatalog } from "@/features/enrollment/lib/catalog";
import { JoinPageClient } from "@/features/enrollment/components/JoinPageClient";

interface PageProps {
  searchParams: Promise<{ product?: string; renew?: string }>;
}

export default async function JoinPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const products = await loadKiryatAtaCatalog();

  return (
    <div className="space-y-10">
      <header className="text-center">
        <p className="text-sm font-medium text-black/50">סניף קריית אתא</p>
        <h1 className="mt-1 text-4xl font-bold text-black">מסלולי אימונים נבחרים</h1>
        <p className="mx-auto mt-3 max-w-md text-black/50">
          בוחרים מסלול, ממלאים את הסכם ההרשמה ומשלמים בכרטיס אשראי. החשבונית מגיעה למייל, וקוד ההתחברות לאפליקציה מגיע בוואטסאפ.
        </p>
      </header>
      <JoinPageClient
        products={products}
        initialProductId={params.product ?? null}
        renewalToken={params.renew ?? null}
      />
    </div>
  );
}
```

`src/features/enrollment/components/JoinPageClient.tsx` (the island; its `onSubmit` is wired in Task 6, so for this task it only toasts):

```tsx
"use client";

import { useState } from "react";
import type { PlanProduct } from "@/types/plans";
import type { EnrollmentInput } from "@/lib/validations/enrollment";
import { EnrollmentForm } from "./EnrollmentForm";
import { PlanCatalog } from "./PlanCatalog";

interface JoinPageClientProps {
  products: PlanProduct[];
  initialProductId: string | null;
  renewalToken: string | null;
  prefill?: Partial<EnrollmentInput>;
}

export function JoinPageClient({ products, initialProductId, renewalToken, prefill }: JoinPageClientProps) {
  const [selected, setSelected] = useState<PlanProduct | null>(
    products.find((p) => p.id === initialProductId) ?? null,
  );

  const handleSubmit = async (): Promise<{ error?: string }> => {
    return { error: "התשלום עדיין לא מחובר" };
  };

  if (products.length === 0) {
    return (
      <p className="rounded-2xl border bg-white p-8 text-center text-black/60">
        אין כרגע מסלולים פתוחים להרשמה. דברו איתנו בוואטסאפ.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {!renewalToken && (
        <PlanCatalog products={products} selectedId={selected?.id ?? null} onSelect={setSelected} />
      )}
      {selected && (
        <section id="enroll" className="rounded-3xl border bg-white p-6 sm:p-8">
          <h2 className="mb-6 text-2xl font-bold">הסכם התקשרות והרשמה</h2>
          <EnrollmentForm
            key={selected.id}
            product={selected}
            prefill={prefill}
            renewalToken={renewalToken ?? undefined}
            onSubmit={handleSubmit}
          />
        </section>
      )}
    </div>
  );
}
```

`src/app/join/terms/page.tsx`:

```tsx
import type { Metadata } from "next";
import { TermsBody } from "@/features/enrollment/components/TermsSheet";

export const metadata: Metadata = { title: "תקנון סניף קריית אתא | Garden of Eden" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-3xl border bg-white p-6 sm:p-10">
      <h1 className="mb-6 text-3xl font-bold">תקנון סניף קריית אתא</h1>
      <TermsBody />
    </article>
  );
}
```

- [ ] **Step 10: Type-check, lint, look**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Start the dev server (it needs the Morning env vars present, even sandbox placeholders, because `env.ts` requires them). Open `http://localhost:3000/join`: seven cards, choosing one opens the four-block form, the תקנון opens in a bottom sheet, submitting a complete form shows the "התשלום עדיין לא מחובר" toast. Check on a 375px wide viewport that nothing overflows.

- [ ] **Step 11: Commit**

```bash
git add src/lib/validations/enrollment.ts src/lib/validations/__tests__/enrollment.test.ts src/features/enrollment src/app/join
git commit -m "feat(signup): public catalog and the digital enrollment agreement form

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Start checkout, return pages, order status

**Files:**
- Create: `src/features/enrollment/lib/actions/start-checkout.ts`, `src/features/enrollment/lib/actions/order-status.ts`
- Create: `src/app/join/success/page.tsx`, `src/app/join/failed/page.tsx`
- Create: `src/features/enrollment/components/OrderStatusPoller.tsx`
- Modify: `src/features/enrollment/components/JoinPageClient.tsx` (wire `startCheckoutAction`)

**Interfaces:**
- Consumes: `enrollmentSchema`, `loadProductById`, `createPaymentForm`, `checkRateLimit`, `isIntroPackEligible`, `verifyRenewalToken`.
- Produces: `startCheckoutAction(input: EnrollmentInput): Promise<{ error: string } | never>` (redirects on success), `getOrderStatusAction(orderId): Promise<{ status: OrderStatus; fulfilled: boolean } | { error: string }>`.

- [ ] **Step 1: Checkout action**

`src/features/enrollment/lib/actions/start-checkout.ts`:

```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { createPaymentForm } from "@/lib/morning/client";
import { isIntroPackEligible } from "@/lib/plans/eligibility";
import { verifyRenewalToken } from "@/lib/plans/renewal-token";
import { israelToday } from "@/lib/utils/tasks";
import { enrollmentSchema, type EnrollmentInput } from "@/lib/validations/enrollment";
import { TERMS_VERSION } from "../../../../../content/terms-kiryat-ata";
import { loadProductById } from "../catalog";

type StartResult = { error: string };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.edengarden.co.il";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Validates the agreement, records a pending order and the signed agreement,
 * asks Morning for a payment page, and sends the parent there.
 *
 * Unauthenticated by design: the parent has no account yet. The payment rate
 * limit (10 an hour per IP, fails closed) is the abuse guard.
 */
export async function startCheckoutAction(input: EnrollmentInput): Promise<StartResult> {
  const ip = await clientIp();
  const limit = await checkRateLimit(`ip:${ip}`, "payment");
  waitUntil(limit.pending);
  if (limit.rateLimited) return { error: "יותר מדי ניסיונות. נסו שוב בעוד שעה." };

  const validated = enrollmentSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "אימות נתונים נכשל" };
  }
  const data = validated.data;

  const product = await loadProductById(data.productId);
  if (!product || !product.is_active) return { error: "המסלול אינו זמין" };

  const db = createAdminClient();

  // A renewal token names the plan being renewed; an invalid one simply makes
  // this a fresh purchase for the same phone.
  let renewalOfPlanId: string | null = null;
  if (data.renewalToken) {
    const secret = process.env.PLAN_RENEWAL_TOKEN_SECRET ?? "";
    const verified = verifyRenewalToken(data.renewalToken, secret, Math.floor(Date.now() / 1000));
    renewalOfPlanId = verified?.planId ?? null;
  }

  if (product.once_per_trainee) {
    const { count } = await typedFrom(db, "orders")
      .select("id", { count: "exact", head: true })
      .eq("login_phone", data.loginPhone)
      .eq("status", "paid")
      .eq("product_id", product.id);
    if (!isIntroPackEligible(product, count ?? 0)) {
      return { error: "חבילת ההיכרות היא לשחקן חדש בלבד. בחרו מסלול אחר." };
    }
  }

  const { data: order, error: orderError } = (await typedFrom(db, "orders")
    .insert({
      product_id: product.id,
      branch_id: product.branch_id,
      amount_ils: product.price_ils,
      parent_name: data.parentName,
      payer_phone: data.payerPhone,
      login_phone: data.loginPhone,
      child_name: data.childName,
      child_birthdate: data.childBirthdate,
      email: data.email,
      renewal_of_plan_id: renewalOfPlanId,
    })
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (orderError || !order) {
    console.error("startCheckout order insert error:", orderError);
    return { error: "שגיאה בשמירת ההזמנה" };
  }

  const { error: agreementError } = await typedFrom(db, "enrollment_agreements").insert({
    order_id: order.id,
    agreement_version: TERMS_VERSION,
    parent_name: data.parentName,
    parent_id_number: data.parentIdNumber.replace(/\s+/g, ""),
    parent_phone: data.payerPhone,
    parent_email: data.email,
    child_name: data.childName,
    child_birthdate: data.childBirthdate,
    medical_notes: data.medicalNotes,
    plan_name: product.name_he,
    plan_price_ils: product.price_ils,
    plan_start_on: israelToday(),
    payment_method: "כרטיס אשראי",
    emergency_contact_name: data.emergencyContactName,
    emergency_contact_phone: data.emergencyContactPhone,
    declares_healthy: data.declaresHealthy,
    accepts_terms: data.acceptsTerms,
    authorizes_payment: data.authorizesPayment,
    photo_consent: data.photoConsent,
    signature_name: data.signatureName,
    signed_ip: ip,
  });

  if (agreementError) {
    console.error("startCheckout agreement insert error:", agreementError);
    await typedFrom(db, "orders").update({ status: "failed" }).eq("id", order.id);
    return { error: "שגיאה בשמירת ההסכם" };
  }

  const form = await createPaymentForm({
    orderId: order.id,
    description: `${product.name_he} - ${data.childName}`,
    amountIls: product.price_ils,
    client: { name: data.parentName, mobile: data.payerPhone, email: data.email },
    successUrl: `${SITE_URL}/join/success?order=${order.id}`,
    failureUrl: `${SITE_URL}/join/failed?order=${order.id}`,
    notifyUrl: `${SITE_URL}/api/webhooks/morning/notify`,
  });

  if ("error" in form) {
    await typedFrom(db, "orders").update({ status: "failed" }).eq("id", order.id);
    return { error: `${form.error}. אפשר לפנות אלינו בוואטסאפ.` };
  }

  await typedFrom(db, "orders")
    .update({ morning_payment_url: form.url })
    .eq("id", order.id);

  redirect(form.url);
}
```

`redirect()` throws a special error that Next handles; the client wrapper must not catch it as a failure. In `JoinPageClient.tsx`, replace the stub with:

```tsx
import { startCheckoutAction } from "@/features/enrollment/lib/actions/start-checkout";
...
  const handleSubmit = async (input: EnrollmentInput): Promise<{ error?: string }> => {
    const result = await startCheckoutAction(input);
    return result ?? {};
  };
```

and remove the unused `EnrollmentInput`-less stub. Because the action redirects, `startCheckoutAction` only ever returns on error.

- [ ] **Step 2: Order status action and poller**

`src/features/enrollment/lib/actions/order-status.ts`:

```ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import type { OrderStatus } from "@/types/plans";

type StatusResult = { status: OrderStatus; fulfilled: boolean } | { error: string };

/**
 * Public by necessity: the parent on the success page has no session. It
 * leaks nothing beyond a status for a uuid the caller already holds.
 */
export async function getOrderStatusAction(orderId: string): Promise<StatusResult> {
  if (!isValidUUID(orderId)) return { error: "מזהה הזמנה לא תקין" };

  const { data } = (await typedFrom(createAdminClient(), "orders")
    .select("status, fulfilled_at")
    .eq("id", orderId)
    .maybeSingle()) as { data: { status: OrderStatus; fulfilled_at: string | null } | null };

  if (!data) return { error: "ההזמנה לא נמצאה" };
  return { status: data.status, fulfilled: data.fulfilled_at !== null };
}
```

`src/features/enrollment/components/OrderStatusPoller.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { getOrderStatusAction } from "../lib/actions/order-status";

const POLL_MS = 3_000;
const MAX_POLLS = 20;

type View = "waiting" | "confirmed" | "timeout";

export function OrderStatusPoller({ orderId }: { orderId: string }) {
  const [view, setView] = useState<View>("waiting");

  useEffect(() => {
    let polls = 0;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      polls += 1;
      const result = await getOrderStatusAction(orderId);
      if (cancelled) return;
      if ("status" in result && result.status === "paid") {
        setView("confirmed");
        return;
      }
      if (polls >= MAX_POLLS) {
        setView("timeout");
        return;
      }
      setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (view === "confirmed") {
    return (
      <div className="space-y-2 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="text-2xl font-bold">התשלום התקבל</h1>
        <p className="text-black/60">
          קוד ההתחברות לאפליקציה יגיע בוואטסאפ למספר של החניך, והחשבונית למייל.
        </p>
      </div>
    );
  }

  if (view === "timeout") {
    return (
      <div className="space-y-2 text-center">
        <Clock className="mx-auto h-12 w-12 text-black/40" />
        <h1 className="text-2xl font-bold">התשלום בטיפול</h1>
        <p className="text-black/60">אישור התשלום יגיע בוואטסאפ בדקות הקרובות.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-center">
      <Loader2 className="mx-auto h-12 w-12 animate-spin text-black/40" />
      <h1 className="text-2xl font-bold">ממתינים לאישור התשלום</h1>
      <p className="text-black/60">זה לוקח כמה שניות.</p>
    </div>
  );
}
```

`src/app/join/success/page.tsx`:

```tsx
import { isValidUUID } from "@/lib/validations/common";
import { OrderStatusPoller } from "@/features/enrollment/components/OrderStatusPoller";

interface PageProps {
  searchParams: Promise<{ order?: string }>;
}

export default async function JoinSuccessPage({ searchParams }: PageProps) {
  const { order } = await searchParams;
  return (
    <div className="mx-auto max-w-lg rounded-3xl border bg-white p-10">
      {order && isValidUUID(order) ? (
        <OrderStatusPoller orderId={order} />
      ) : (
        <p className="text-center text-black/60">אישור התשלום יגיע בוואטסאפ.</p>
      )}
    </div>
  );
}
```

`src/app/join/failed/page.tsx`:

```tsx
import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function JoinFailedPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-3xl border bg-white p-10 text-center">
      <XCircle className="mx-auto h-12 w-12 text-destructive" />
      <h1 className="text-2xl font-bold">התשלום לא הושלם</h1>
      <p className="text-black/60">לא חויבתם. אפשר לנסות שוב או לדבר איתנו בוואטסאפ.</p>
      <Button asChild>
        <Link href="/join">חזרה לבחירת מסלול</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Type-check, lint, sandbox check**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

With sandbox Morning keys in `.env.local`, submit the form on `/join`. Expected: the browser lands on a Morning sandbox payment page; `SELECT status, morning_payment_url FROM orders ORDER BY created_at DESC LIMIT 1` shows `pending` and a URL; `enrollment_agreements` has a row for the order. Do not pay yet; the webhook comes in Task 7.

- [ ] **Step 4: Commit**

```bash
git add src/features/enrollment src/app/join
git commit -m "feat(signup): start checkout on Morning and poll the order on return

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Webhook and fulfillment

**Files:**
- Create: `src/features/enrollment/lib/fulfillment.ts`
- Create: `src/app/api/webhooks/morning/route.ts`, `src/app/api/webhooks/morning/notify/route.ts`

**Interfaces:**
- Consumes: `verifyMorningSignature`, `extractOrderId`, `phoneVariants`, `renewalStartDate`, `replaceProfileBranches`, `loadBranchIdsByProfile`, `addDays`, `israelToday`.
- Produces: `fulfillOrder(db, orderId): Promise<{ ok: true; profileId: string; planId: string } | { ok: false; error: string }>`; `POST /api/webhooks/morning`.

- [ ] **Step 1: Fulfillment**

`src/features/enrollment/lib/fulfillment.ts`:

```ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  loadBranchIdsByProfile,
  replaceProfileBranches,
} from "@/features/branches/lib/memberships";
import { phoneVariants } from "@/lib/plans/phone-variants";
import { renewalStartDate } from "@/lib/plans/plan-status";
import { addDays } from "@/lib/utils/iso-date";
import { israelToday } from "@/lib/utils/tasks";
import type { EnrollmentAgreement, Order, PlanProduct, TraineePlan } from "@/types/plans";

export type FulfillResult =
  | { ok: true; profileId: string; planId: string }
  | { ok: false; error: string };

interface FulfillInput {
  order: Order;
  product: PlanProduct;
  agreement: EnrollmentAgreement | null;
  /** Null for online orders; the admin for manual grants. */
  createdBy: string | null;
}

/** The profile whose auth phone is this login phone, in any stored spelling. */
async function findProfileByPhone(db: SupabaseClient, e164: string): Promise<string | null> {
  const { data } = await db
    .from("profiles")
    .select("id")
    .in("phone", phoneVariants(e164))
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function createAccount(db: SupabaseClient, e164: string, childName: string): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    phone: e164,
    phone_confirm: true,
    user_metadata: { full_name: childName },
  });
  if (error || !data.user) {
    // A race with a parallel webhook can create the user first; look again.
    const existing = await findProfileByPhone(db, e164);
    if (existing) return existing;
    throw new Error(`auth createUser failed: ${error?.message ?? "no user"}`);
  }
  return data.user.id;
}

/**
 * Turns a paid order into a person with a plan. Every step is safe to rerun:
 * an existing account is reused, memberships are merged, and the plan is
 * only inserted when the order has none yet.
 */
export async function fulfillFromInput(
  db: SupabaseClient,
  { order, product, agreement, createdBy }: FulfillInput,
): Promise<FulfillResult> {
  try {
    const profileId =
      order.profile_id ??
      (await findProfileByPhone(db, order.login_phone)) ??
      (await createAccount(db, order.login_phone, order.child_name));

    const { data: profile } = await db
      .from("profiles")
      .select("full_name, birthdate")
      .eq("id", profileId)
      .single();

    const { error: profileError } = await db
      .from("profiles")
      .update({
        full_name: profile?.full_name || order.child_name,
        birthdate: profile?.birthdate || order.child_birthdate,
        role: "trainee",
        profile_completed: true,
        guardian_name: order.parent_name,
        guardian_phone: order.payer_phone,
        medical_notes: agreement?.medical_notes ?? null,
        emergency_contact_name: agreement?.emergency_contact_name ?? null,
        emergency_contact_phone: agreement?.emergency_contact_phone ?? null,
        photo_consent: agreement?.photo_consent ?? null,
      })
      .eq("id", profileId);
    if (profileError) throw new Error(`profile update failed: ${profileError.message}`);

    const memberships = (await loadBranchIdsByProfile(db, [profileId])).get(profileId) ?? [];
    if (!memberships.includes(order.branch_id)) {
      const { error } = await replaceProfileBranches(
        db,
        profileId,
        [...memberships, order.branch_id],
        { stampAdmin: true },
      );
      if (error) throw new Error(`branch link failed: ${error}`);
    }

    const { data: existingPlan } = (await typedFrom(db, "trainee_plans")
      .select("id")
      .eq("order_id", order.id)
      .maybeSingle()) as { data: { id: string } | null };

    let planId = existingPlan?.id ?? null;
    if (!planId) {
      let previousEndsOn: string | null = null;
      if (order.renewal_of_plan_id) {
        const { data: previous } = (await typedFrom(db, "trainee_plans")
          .select("ends_on")
          .eq("id", order.renewal_of_plan_id)
          .maybeSingle()) as { data: Pick<TraineePlan, "ends_on"> | null };
        previousEndsOn = previous?.ends_on ?? null;
      }
      const startsOn = renewalStartDate(previousEndsOn, israelToday());
      const { data: plan, error: planError } = (await typedFrom(db, "trainee_plans")
        .insert({
          profile_id: profileId,
          product_id: product.id,
          branch_id: order.branch_id,
          order_id: order.id,
          starts_on: startsOn,
          ends_on: addDays(startsOn, product.duration_days - 1),
          sessions_total: product.sessions_total,
          source: createdBy ? "manual" : "online",
          created_by: createdBy,
        })
        .select("id")
        .single()) as { data: { id: string } | null; error: { message: string } | null };
      if (planError || !plan) throw new Error(`plan insert failed: ${planError?.message}`);
      planId = plan.id;
    }

    if (agreement && !agreement.profile_id) {
      await typedFrom(db, "enrollment_agreements")
        .update({ profile_id: profileId })
        .eq("id", agreement.id);
    }

    const { error: orderError } = await typedFrom(db, "orders")
      .update({ profile_id: profileId, fulfilled_at: new Date().toISOString(), fulfillment_error: null })
      .eq("id", order.id);
    if (orderError) throw new Error(`order update failed: ${orderError.message}`);

    return { ok: true, profileId, planId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[fulfillment] order ${order.id}:`, message);
    await typedFrom(db, "orders").update({ fulfillment_error: message }).eq("id", order.id);
    return { ok: false, error: message };
  }
}

/** Loads a paid order with its product and agreement and fulfills it. */
export async function fulfillOrder(db: SupabaseClient, orderId: string): Promise<FulfillResult> {
  const { data: order } = (await typedFrom(db, "orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle()) as { data: Order | null };
  if (!order) return { ok: false, error: "order not found" };
  if (order.status !== "paid") return { ok: false, error: `order is ${order.status}` };
  if (order.fulfilled_at) {
    return { ok: true, profileId: order.profile_id ?? "", planId: "" };
  }

  const [{ data: product }, { data: agreement }] = await Promise.all([
    typedFrom(db, "plan_products").select("*").eq("id", order.product_id).maybeSingle() as Promise<{ data: PlanProduct | null }>,
    typedFrom(db, "enrollment_agreements").select("*").eq("order_id", order.id).maybeSingle() as Promise<{ data: EnrollmentAgreement | null }>,
  ]);
  if (!product) return { ok: false, error: "product not found" };

  return fulfillFromInput(db, {
    order: { ...order, amount_ils: Number(order.amount_ils) },
    product: { ...product, price_ils: Number(product.price_ils) },
    agreement,
    createdBy: null,
  });
}
```

- [ ] **Step 2: Webhook route**

`src/app/api/webhooks/morning/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { getMorningConfig } from "@/lib/morning/config";
import {
  extractOrderId,
  verifyMorningSignature,
  type MorningDocumentCreated,
  type MorningPaymentReceived,
} from "@/lib/morning/webhook";
import { fulfillOrder } from "@/features/enrollment/lib/fulfillment";
import { notifyOrderFulfilled } from "@/features/enrollment/lib/notify";

/**
 * Morning webhooks (Developer Tools > Webhooks, topics payment/received and
 * document/created). This is the only path that marks an order paid.
 *
 * Every delivery is stored once by its delivery id; a retried delivery is
 * acknowledged and ignored. Anything that fails after the signature check is
 * still acknowledged with 200 and recorded on the event row, because Morning
 * disables a webhook after fifteen failures and the fix belongs on our side.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const { webhookSecret } = getMorningConfig();

  if (!verifyMorningSignature(rawBody, request.headers.get("x-webhook-signature"), webhookSecret)) {
    console.error("[Morning Webhook] signature mismatch");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const deliveryId = request.headers.get("x-webhook-delivery-id") ?? "";
  const topic = request.headers.get("x-webhook-topic") ?? "";
  if (!deliveryId || !topic) {
    return NextResponse.json({ error: "Missing webhook headers" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = createAdminClient();
  const custom = (payload as { custom?: unknown }).custom;
  const orderId = extractOrderId(custom);

  const { error: insertError } = await typedFrom(db, "morning_webhook_events").insert({
    delivery_id: deliveryId,
    topic,
    payload,
    order_id: orderId,
  });
  if (insertError) {
    // 23505 = already stored: a retry of a delivery we handled.
    if (insertError.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    console.error("[Morning Webhook] event insert failed:", insertError);
    return NextResponse.json({ error: "Storage failed" }, { status: 500 });
  }

  const finish = async (error: string | null) => {
    await typedFrom(db, "morning_webhook_events")
      .update({ processed_at: new Date().toISOString(), error })
      .eq("delivery_id", deliveryId);
    return NextResponse.json({ ok: true, error });
  };

  if (!orderId) return finish("no order id in custom");

  if (topic === "payment/received") {
    const event = payload as MorningPaymentReceived;
    const transactionId = event.transactions?.[0]?.id ?? event.id ?? null;

    const { data: order } = (await typedFrom(db, "orders")
      .select("id, status")
      .eq("id", orderId)
      .maybeSingle()) as { data: { id: string; status: string } | null };
    if (!order) return finish("order not found");
    if (order.status === "paid") return finish(null);

    const { error: updateError } = await typedFrom(db, "orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        morning_transaction_id: transactionId,
        raw_webhook: payload,
      })
      .eq("id", orderId)
      .eq("status", "pending");
    if (updateError) {
      if (updateError.code === "23505") return finish("transaction id already used");
      return finish(`order update failed: ${updateError.message}`);
    }

    const result = await fulfillOrder(db, orderId);
    if (!result.ok) return finish(`fulfillment: ${result.error}`);

    await notifyOrderFulfilled(db, orderId);
    return finish(null);
  }

  if (topic === "document/created") {
    const event = payload as MorningDocumentCreated;
    await typedFrom(db, "orders")
      .update({
        morning_document_id: event.id ?? null,
        morning_document_url: event.files?.downloadLinks?.he ?? event.files?.downloadLinks?.origin ?? null,
      })
      .eq("id", orderId);
    return finish(null);
  }

  return finish(`unhandled topic ${topic}`);
}
```

`src/app/api/webhooks/morning/notify/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Morning's notifyUrl. Its body is undocumented, so it is logged and never
 * trusted; the signed webhook above is the source of truth.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  console.log("[Morning notify]", body.slice(0, 1000));
  return NextResponse.json({ ok: true });
}
```

Task 8 creates `notifyOrderFulfilled`; until then, add a temporary stub file `src/features/enrollment/lib/notify.ts`:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function notifyOrderFulfilled(_db: SupabaseClient, _orderId: string): Promise<void> {
  // Replaced in Task 8.
}
```

- [ ] **Step 3: Type-check, lint, sandbox round-trip**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Round-trip in the sandbox: expose the dev server with `vercel dev` tunnelling or deploy a preview (`vercel`), register the preview URL `/api/webhooks/morning` as a webhook in Morning's sandbox Developer Tools for `payment/received` and `document/created` with the secret from `MORNING_WEBHOOK_SECRET`, then pay a sandbox order with Morning's test card. Expected within a minute:

```sql
SELECT status, paid_at, fulfilled_at, fulfillment_error, profile_id FROM orders ORDER BY created_at DESC LIMIT 1;
SELECT starts_on, ends_on, sessions_total, source FROM trainee_plans ORDER BY created_at DESC LIMIT 1;
SELECT topic, error FROM morning_webhook_events ORDER BY received_at DESC LIMIT 3;
```

`paid`, both timestamps set, no error, a profile id; a plan with the product's duration; two events with null errors. Replay the delivery from Morning's UI: the event count does not grow and no second plan appears.

- [ ] **Step 4: Commit**

```bash
git add src/features/enrollment/lib/fulfillment.ts src/features/enrollment/lib/notify.ts src/app/api/webhooks/morning
git commit -m "feat(signup): signed Morning webhook marks orders paid and fulfills them

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Confirmations and the printable agreement

**Files:**
- Modify: `src/features/enrollment/lib/notify.ts` (replace the stub)
- Create: `src/lib/whatsapp/plan-templates.ts`
- Create: `src/lib/plans/agreement-token.ts` with test `src/lib/plans/__tests__/agreement-token.test.ts`
- Create: `src/app/join/agreement/[id]/page.tsx`, `src/features/enrollment/components/AgreementPrintable.tsx`

**Interfaces:**
- Produces: `sendPlanConfirmed(phone, params: { parentName; childName; planName; endsOn; agreementUrl })`, `notifyOrderFulfilled(db, orderId)`, `signAgreementToken(agreementId, secret)`, `verifyAgreementToken(agreementId, token, secret)`.

- [ ] **Step 1: Failing token test**

`src/lib/plans/__tests__/agreement-token.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { signAgreementToken, verifyAgreementToken } from "../agreement-token";

const ID = "11111111-1111-4111-8111-111111111111";

describe("agreement token", () => {
  it("verifies its own signature and rejects others", () => {
    const token = signAgreementToken(ID, "s");
    expect(verifyAgreementToken(ID, token, "s")).toBe(true);
    expect(verifyAgreementToken(ID, token, "other")).toBe(false);
    expect(verifyAgreementToken("22222222-2222-4222-8222-222222222222", token, "s")).toBe(false);
    expect(verifyAgreementToken(ID, "nope", "s")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:run -- src/lib/plans/__tests__/agreement-token.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/plans/agreement-token.ts`:

```ts
import { createHmac, timingSafeEqual } from "crypto";

/**
 * The parent's copy of the agreement is a public URL guarded by an HMAC of
 * the agreement id. No expiry: a signed contract should stay retrievable.
 */
export function signAgreementToken(agreementId: string, secret: string): string {
  return createHmac("sha256", secret).update(`agreement.${agreementId}`).digest("hex");
}

export function verifyAgreementToken(agreementId: string, token: string, secret: string): boolean {
  const expected = signAgreementToken(agreementId, secret);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token, "utf8"), Buffer.from(expected, "utf8"));
}
```

`src/lib/whatsapp/plan-templates.ts`:

```ts
import { callWhatsAppAPI, getConfig, type WhatsAppResult } from "./api";

interface PlanConfirmedParams {
  parentName: string;
  childName: string;
  planName: string;
  /** DD/MM/YYYY for the message body. */
  endsOn: string;
  agreementUrl: string;
}

/**
 * Meta-approved template WHATSAPP_PLAN_CONFIRMED_TEMPLATE_NAME with body
 * parameters {{1}} parent, {{2}} child, {{3}} plan, {{4}} end date, {{5}} link.
 */
export async function sendPlanConfirmed(
  phone: string,
  params: PlanConfirmedParams,
): Promise<WhatsAppResult> {
  const templateName = process.env.WHATSAPP_PLAN_CONFIRMED_TEMPLATE_NAME?.trim();
  if (!templateName) {
    return { success: false, error: "WHATSAPP_PLAN_CONFIRMED_TEMPLATE_NAME not configured" };
  }
  const { token, phoneNumberId } = getConfig();
  return callWhatsAppAPI(phoneNumberId, token, {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "he" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: params.parentName },
            { type: "text", text: params.childName },
            { type: "text", text: params.planName },
            { type: "text", text: params.endsOn },
            { type: "text", text: params.agreementUrl },
          ],
        },
      ],
    },
  });
}

interface PlanReminderParams {
  parentName: string;
  childName: string;
  planName: string;
  /** "בעוד 3 ימים", "נותר אימון אחד", "הסתיים" */
  reason: string;
  renewUrl: string;
}

/**
 * Meta-approved template WHATSAPP_PLAN_REMINDER_TEMPLATE_NAME with body
 * parameters {{1}} parent, {{2}} child, {{3}} plan, {{4}} reason, {{5}} link.
 */
export async function sendPlanReminder(
  phone: string,
  params: PlanReminderParams,
): Promise<WhatsAppResult> {
  const templateName = process.env.WHATSAPP_PLAN_REMINDER_TEMPLATE_NAME?.trim();
  if (!templateName) {
    return { success: false, error: "WHATSAPP_PLAN_REMINDER_TEMPLATE_NAME not configured" };
  }
  const { token, phoneNumberId } = getConfig();
  return callWhatsAppAPI(phoneNumberId, token, {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "he" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: params.parentName },
            { type: "text", text: params.childName },
            { type: "text", text: params.planName },
            { type: "text", text: params.reason },
            { type: "text", text: params.renewUrl },
          ],
        },
      ],
    },
  });
}
```

Replace `src/features/enrollment/lib/notify.ts`:

```ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { signAgreementToken } from "@/lib/plans/agreement-token";
import { sendWelcomeMessage } from "@/lib/whatsapp/welcome";
import { sendPlanConfirmed } from "@/lib/whatsapp/plan-templates";
import type { Order, TraineePlan } from "@/types/plans";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.edengarden.co.il";

function ddmmyyyy(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/**
 * Two messages after fulfillment: the app welcome to the child's login phone
 * when the account is new (the welcome dispatcher only covers Arbox accounts),
 * and the plan confirmation with the agreement link to the parent.
 * Best-effort: a failed send is logged, never thrown; the money already landed.
 */
export async function notifyOrderFulfilled(db: SupabaseClient, orderId: string): Promise<void> {
  const { data: order } = (await typedFrom(db, "orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle()) as { data: Order | null };
  if (!order || !order.profile_id) return;

  const [{ data: plan }, { data: agreement }, { data: profile }, { data: product }] = await Promise.all([
    typedFrom(db, "trainee_plans").select("ends_on").eq("order_id", order.id).maybeSingle() as Promise<{ data: Pick<TraineePlan, "ends_on"> | null }>,
    typedFrom(db, "enrollment_agreements").select("id").eq("order_id", order.id).maybeSingle() as Promise<{ data: { id: string } | null }>,
    db.from("profiles").select("welcome_message_sent_at, full_name").eq("id", order.profile_id).maybeSingle(),
    typedFrom(db, "plan_products").select("name_he").eq("id", order.product_id).maybeSingle() as Promise<{ data: { name_he: string } | null }>,
  ]);

  if (profile && !profile.welcome_message_sent_at) {
    const welcome = await sendWelcomeMessage(order.login_phone, profile.full_name);
    if (welcome.success) {
      await db
        .from("profiles")
        .update({ welcome_message_sent_at: new Date().toISOString() })
        .eq("id", order.profile_id);
    } else {
      console.error(`[notify] welcome failed for order ${order.id}:`, welcome.error);
    }
  }

  const secret = process.env.PLAN_RENEWAL_TOKEN_SECRET ?? "";
  const agreementUrl = agreement
    ? `${SITE_URL}/join/agreement/${agreement.id}?t=${signAgreementToken(agreement.id, secret)}`
    : `${SITE_URL}/join`;

  const confirmed = await sendPlanConfirmed(order.payer_phone, {
    parentName: order.parent_name,
    childName: order.child_name,
    planName: product?.name_he ?? "המסלול",
    endsOn: plan ? ddmmyyyy(plan.ends_on) : "",
    agreementUrl,
  });
  if (!confirmed.success) {
    console.error(`[notify] plan confirmed failed for order ${order.id}:`, confirmed.error);
  }
}
```

- [ ] **Step 4: Printable agreement**

`src/features/enrollment/components/AgreementPrintable.tsx`:

```tsx
import type { EnrollmentAgreement } from "@/types/plans";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border-b border-dashed pb-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="min-h-6 font-medium">{value || ""}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="border-s-4 border-[#CDEA68] ps-3 text-lg font-bold">{title}</h2>
      <div className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const ddmmyyyy = (iso: string) => iso.split("-").reverse().join("/");

export function AgreementPrintable({ agreement }: { agreement: EnrollmentAgreement }) {
  return (
    <article className="mx-auto max-w-3xl space-y-8 rounded-3xl border bg-white p-6 print:border-0 sm:p-10">
      <header className="text-center">
        <h1 className="text-2xl font-bold">הסכם התקשרות והרשמה</h1>
        <p className="text-sm text-muted-foreground">Garden Of Eden. טופס להשלמה על ידי ההורה / האפוטרופוס</p>
      </header>

      <Block title="פרטי ההורה / האפוטרופוס">
        <Field label="שם מלא" value={agreement.parent_name} />
        <Field label="מספר ת.ז" value={agreement.parent_id_number} />
        <Field label="טלפון נייד" value={agreement.parent_phone} />
        <Field label='דוא"ל' value={agreement.parent_email} />
      </Block>

      <Block title="פרטי החניך/ה">
        <Field label="שם מלא" value={agreement.child_name} />
        <Field label="תאריך לידה" value={ddmmyyyy(agreement.child_birthdate)} />
        <div className="sm:col-span-2">
          <Field label="אלרגיות / מגבלות רפואיות ידועות" value={agreement.medical_notes} />
        </div>
      </Block>

      <Block title="פרטי המסלול הנרכש">
        <Field label="סוג מסלול" value={agreement.plan_name} />
        <Field label="תאריך תחילה" value={ddmmyyyy(agreement.plan_start_on)} />
        <Field label="עלות" value={`₪${Number(agreement.plan_price_ils).toLocaleString("he-IL")}`} />
        <Field label="אמצעי תשלום" value={agreement.payment_method} />
      </Block>

      <Block title="איש קשר נוסף למקרה חירום">
        <Field label="שם מלא" value={agreement.emergency_contact_name} />
        <Field label="טלפון" value={agreement.emergency_contact_phone} />
      </Block>

      <section className="space-y-2 rounded-2xl border p-4 text-sm">
        <h2 className="font-bold">הצהרות ואישורים</h2>
        <p>[x] אני מצהיר/ה כי החניך/ה כשיר/ה מבחינה בריאותית להשתתף בפעילות גופנית.</p>
        <p>[x] אני מאשר/ת כי קראתי את תקנון Garden Of Eden במלואו (גרסה {agreement.agreement_version}) ואני מסכים/ה לו.</p>
        <p>[x] אני מסמיך/ה את גארדן אוף עדן לחייב את אמצעי התשלום שנמסר.</p>
        <p>{agreement.photo_consent ? "[x] מאשר/ת צילום" : "[x] לא מעוניין/ת בצילום"}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="שם ההורה + חתימה" value={agreement.signature_name} />
        <Field label="תאריך" value={new Date(agreement.signed_at).toLocaleDateString("he-IL")} />
      </section>
      <p className="text-center text-xs text-muted-foreground">
        נחתם דיגיטלית בתאריך {new Date(agreement.signed_at).toLocaleString("he-IL")}. Garden of Eden, Boutique Soccer Field
      </p>
    </article>
  );
}
```

`src/app/join/agreement/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAgreementToken } from "@/lib/plans/agreement-token";
import { isValidUUID } from "@/lib/validations/common";
import { AgreementPrintable } from "@/features/enrollment/components/AgreementPrintable";
import type { EnrollmentAgreement } from "@/types/plans";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}

/** The parent's copy. Public URL, guarded by the HMAC in the WhatsApp link. */
export default async function AgreementPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { t } = await searchParams;
  const secret = process.env.PLAN_RENEWAL_TOKEN_SECRET ?? "";
  if (!isValidUUID(id) || !t || !verifyAgreementToken(id, t, secret)) notFound();

  const { data } = (await typedFrom(createAdminClient(), "enrollment_agreements")
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: EnrollmentAgreement | null };
  if (!data) notFound();

  return <AgreementPrintable agreement={data} />;
}
```

- [ ] **Step 5: Tests, type-check, lint, check**

Run: `npm run test:run -- src/lib/plans && npx tsc --noEmit && npm run lint`
Expected: PASS, 0 errors, 0 lint errors.

Open the agreement URL printed by a fulfilled order (build it from the agreement id and `signAgreementToken` in a one-off `npx tsx` script if no WhatsApp template exists yet): the four blocks render with the stored values; a wrong `t` gives 404.

- [ ] **Step 6: Commit**

```bash
git add src/features/enrollment src/lib/whatsapp/plan-templates.ts src/lib/plans/agreement-token.ts src/lib/plans/__tests__/agreement-token.test.ts src/app/join/agreement
git commit -m "feat(signup): WhatsApp confirmations and the parent's printable agreement

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Plan 1 wrap-up

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`
Expected: 0 tsc errors, 0 lint errors, the two baseline test files still the only failures, build compiles.

- [ ] **Step 2: CLAUDE.md**

Under "Environment Variables" add the seven Morning and plan variables to the required list. Under "Architecture" add:

```markdown
### קריית אתא signup

`/join` sells `plan_products`, records an `orders` row and a signed `enrollment_agreements` row, and sends the parent to Morning's hosted payment page. Only the signed webhook at `src/app/api/webhooks/morning/route.ts` marks an order paid; `src/features/enrollment/lib/fulfillment.ts` then creates the account, the branch link, and the `trainee_plans` row, and is safe to rerun. Plan state is derived by `resolvePlanStatus()` in `src/lib/plans/`, never stored. Spec: `docs/superpowers/specs/2026-09-10-kiryat-ata-signup-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(signup): document the checkout and fulfillment path

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Then continue with `docs/superpowers/plans/2026-09-10-signup-2-plans-reminders.md`.
