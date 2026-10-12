/**
 * A payment by cheque (צ׳ק). Morning's receipt for a cheque requires its
 * number, bank, branch and account, so staff type all four and the order
 * keeps them: the number in orders.reference, the rest in cheque_*. One
 * cheque per payment.
 */

/** What the sheet sends beside the reference, which holds the cheque number. */
export interface ChequeBankDraft {
  bank: string;
  branch: string;
  account: string;
}

export interface ChequeDetails extends ChequeBankDraft {
  number: string;
}

/**
 * The longest each detail may be. bank, branch and account are the column
 * limits (orders_cheque_*_check); the number is held tighter than
 * orders_reference_check (60) because a real cheque number is short.
 */
export const CHEQUE_LIMITS = { number: 20, bank: 40, branch: 10, account: 20 } as const;
const DIGITS = /^\d+$/;
const ACCOUNT = /^[\d-]+$/;

/**
 * The cheque behind a payment, or why it cannot be recorded. Any method but
 * check has none, so fields left over from a switched method are dropped.
 */
export function chequeDetails(
  method: string,
  reference: string | null,
  draft: ChequeBankDraft | null,
): { ok: true; details: ChequeDetails | null } | { ok: false; problem: string } {
  if (method !== "check") return { ok: true, details: null };

  const number = reference?.trim() ?? "";
  const bank = draft?.bank.trim() ?? "";
  const branch = draft?.branch.trim() ?? "";
  const account = draft?.account.trim() ?? "";

  if (!number) return { ok: false, problem: "נדרש מספר הצ׳ק" };
  if (!DIGITS.test(number)) return { ok: false, problem: "מספר הצ׳ק: ספרות בלבד" };
  if (number.length > CHEQUE_LIMITS.number) return { ok: false, problem: "מספר הצ׳ק ארוך מדי" };
  if (!bank) return { ok: false, problem: "נדרש שם הבנק" };
  if (bank.length > CHEQUE_LIMITS.bank) return { ok: false, problem: "שם הבנק ארוך מדי" };
  if (!branch) return { ok: false, problem: "נדרש מספר הסניף" };
  if (!DIGITS.test(branch)) return { ok: false, problem: "מספר הסניף: ספרות בלבד" };
  if (branch.length > CHEQUE_LIMITS.branch) return { ok: false, problem: "מספר הסניף ארוך מדי" };
  if (!account) return { ok: false, problem: "נדרש מספר החשבון" };
  if (!ACCOUNT.test(account)) return { ok: false, problem: "מספר החשבון: ספרות ומקף בלבד" };
  if (account.length > CHEQUE_LIMITS.account) return { ok: false, problem: "מספר החשבון ארוך מדי" };

  return { ok: true, details: { number, bank, branch, account } };
}
