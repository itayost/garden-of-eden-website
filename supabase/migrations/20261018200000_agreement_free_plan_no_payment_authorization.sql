-- A Plan given without charging (price 0) authorizes no payment, so its
-- agreement is signed with authorizes_payment = false (sign-agreement.ts).
-- The signed-means-declared check still demanded it, so no free Plan's
-- agreement could be signed. Looser than before: every existing row passes.
ALTER TABLE public.enrollment_agreements DROP CONSTRAINT IF EXISTS agreement_signed_means_declared;
ALTER TABLE public.enrollment_agreements
  ADD CONSTRAINT agreement_signed_means_declared
  CHECK (
    signed_at IS NULL
    OR (declares_healthy AND accepts_terms
        AND (authorizes_payment OR plan_price_ils = 0)
        AND signature_name <> '' AND parent_id_number <> '')
  );
