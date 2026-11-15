-- A lead's phone is unique within a tab, not across all leads. Staff paste a
-- monthly list into a new tab even when the same people sit in an older one;
-- the global index refused them (2026-11-11: 149 of 170 pasted rows skipped).
--
-- Deploy the code first: it checks duplicates per tab, and the webhook,
-- WhatsApp flow and tab delete handle one phone in several tabs. The code
-- before it never creates such rows, so this order only matters for the new
-- import to start adding them.
--
-- The new index is created before the old one is dropped: every phone is
-- unique across leads today, so it is unique per tab too.

SET LOCAL lock_timeout = '3s';

CREATE UNIQUE INDEX leads_tab_phone_unique ON public.leads USING btree (tab_id, phone) WHERE (phone IS NOT NULL);

DROP INDEX public.leads_phone_unique;
