-- Payment by cheque (צ׳ק): staff record it by hand like cash, transfer and
-- Bit. Morning's receipt for a cheque (payment type 2) requires the cheque
-- number, bank, branch and account, so the order keeps them: the number in
-- `reference`, the rest in the cheque_* columns. One cheque per order.
-- A refund may go out by cheque too.

SET LOCAL lock_timeout = '3s';

ALTER TABLE public.orders
  ADD COLUMN cheque_bank text,
  ADD COLUMN cheque_branch text,
  ADD COLUMN cheque_account text,
  ADD CONSTRAINT orders_cheque_bank_check CHECK (cheque_bank IS NULL OR char_length(cheque_bank) <= 40),
  ADD CONSTRAINT orders_cheque_branch_check CHECK (cheque_branch IS NULL OR char_length(cheque_branch) <= 10),
  ADD CONSTRAINT orders_cheque_account_check CHECK (cheque_account IS NULL OR char_length(cheque_account) <= 20),
  -- Without every detail Morning refuses the receipt, so the order is refused first.
  ADD CONSTRAINT orders_cheque_details_check CHECK (
    payment_method IS DISTINCT FROM 'check'
    OR (reference IS NOT NULL AND cheque_bank IS NOT NULL AND cheque_branch IS NOT NULL AND cheque_account IS NOT NULL)
  );

ALTER TABLE public.orders DROP CONSTRAINT orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK (
  payment_method IS NULL
  OR payment_method = ANY (ARRAY['cash'::text, 'transfer'::text, 'bit'::text, 'check'::text, 'card'::text, 'arbox'::text, 'free'::text])
);

ALTER TABLE public.plan_refunds DROP CONSTRAINT plan_refunds_method_check;
ALTER TABLE public.plan_refunds ADD CONSTRAINT plan_refunds_method_check CHECK (
  method = ANY (ARRAY['card'::text, 'cash'::text, 'transfer'::text, 'bit'::text, 'check'::text, 'arbox'::text, 'none'::text])
);
