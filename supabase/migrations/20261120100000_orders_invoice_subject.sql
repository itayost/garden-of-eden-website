-- Invoice subject: staff selling a manual Card may name what it is for
-- (מחנה פסח, מחנה קיץ), and the Morning receipt line leads with it
-- (owner's request, issue #181, 2026-11-20).
--
-- Expand only. Apply BEFORE deploying the code that writes it: the sale paths
-- insert this column. The code running today never reads it, and an order
-- without a subject issues exactly as before.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_subject text;

COMMENT ON COLUMN public.orders.invoice_subject IS
  'What a manual Card sale is for, as staff typed it; leads the Morning receipt line. NULL for none.';

-- One line, not blank, within the bound the app holds (MAX_INVOICE_SUBJECT).
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_invoice_subject_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_invoice_subject_check CHECK (
  invoice_subject IS NULL
  OR (char_length(btrim(invoice_subject)) BETWEEN 1 AND 60 AND invoice_subject !~ '[\r\n\t]')
);
