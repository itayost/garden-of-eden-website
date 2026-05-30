-- Make leads.phone optional so name-only leads (no contact number yet) can be
-- stored. Real phone numbers must still be unique; multiple NULLs are allowed.

ALTER TABLE leads ALTER COLUMN phone DROP NOT NULL;

-- Replace the plain UNIQUE(phone) constraint with a partial unique index that
-- ignores NULLs, so several phoneless leads can coexist.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_phone_key;

CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_unique
  ON leads (phone)
  WHERE phone IS NOT NULL;
