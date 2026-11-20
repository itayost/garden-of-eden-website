/**
 * The longest subject a receipt line takes; orders_invoice_subject_check
 * holds the same bound. A leaf module on purpose: manual-card.ts and
 * validations/plans-admin.ts both read it, and plans-admin is imported by
 * discount.ts, which manual-card imports, so the constant cannot live in
 * either without an import cycle that breaks the production build.
 */
export const MAX_INVOICE_SUBJECT = 60;
