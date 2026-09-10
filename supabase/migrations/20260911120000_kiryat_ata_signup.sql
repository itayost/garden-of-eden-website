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
