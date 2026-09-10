-- The card is charged on the site's own payment page (Isracard), and Morning
-- only issues the document. Orders record which provider took the money and
-- the non-sensitive references the acquirer returns: never a PAN, never a CVV.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'morning'
    CHECK (payment_provider IN ('morning', 'isracard', 'manual')),
  ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS approval_number TEXT,
  ADD COLUMN IF NOT EXISTS card_brand TEXT,
  ADD COLUMN IF NOT EXISTS card_last4 TEXT CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'),
  ADD COLUMN IF NOT EXISTS installments SMALLINT NOT NULL DEFAULT 1 CHECK (installments BETWEEN 1 AND 36),
  ADD COLUMN IF NOT EXISTS provider_response JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_transaction_id_key
  ON public.orders (payment_provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
