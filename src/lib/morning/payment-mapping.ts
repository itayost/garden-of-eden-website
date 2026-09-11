import type { CardBrand } from "@/lib/payments/card";

/**
 * How one payment is described to Morning's POST /documents. Pure, so the
 * type codes can be tested and corrected in one place if the sandbox
 * disagrees: 1 cash, 3 credit card, 4 bank transfer, 10 payment app
 * (appType 1 = Bit).
 */
export type ReceiptPayment =
  | { kind: "card"; brand: CardBrand; last4: string; installments: number }
  | { kind: "cash" }
  | { kind: "transfer"; reference: string | null }
  | { kind: "bit"; reference: string | null };

const MORNING_PAYMENT_TYPE = { cash: 1, card: 3, transfer: 4, app: 10 } as const;
const MORNING_APP_TYPE_BIT = 1;

/** Morning's card type codes. */
export const MORNING_CARD_TYPE: Record<CardBrand, number> = {
  isracard: 1,
  visa: 2,
  mastercard: 3,
  amex: 4,
  diners: 5,
  unknown: 0,
};

export function morningPaymentObject(
  payment: ReceiptPayment,
  amountIls: number,
  paidOn: string,
): Record<string, unknown> {
  const base = { price: amountIls, currency: "ILS", date: paidOn };
  switch (payment.kind) {
    case "card":
      return {
        ...base,
        type: MORNING_PAYMENT_TYPE.card,
        cardType: MORNING_CARD_TYPE[payment.brand],
        cardNum: payment.last4,
        dealType: payment.installments > 1 ? 2 : 1,
        numPayments: payment.installments,
      };
    case "cash":
      return { ...base, type: MORNING_PAYMENT_TYPE.cash };
    case "transfer":
      return { ...base, type: MORNING_PAYMENT_TYPE.transfer };
    case "bit":
      return { ...base, type: MORNING_PAYMENT_TYPE.app, appType: MORNING_APP_TYPE_BIT };
  }
}

/** The reference (אסמכתא) goes on the document itself, where the bookkeeper reads it. */
export function receiptRemarks(payment: ReceiptPayment): string | undefined {
  if ((payment.kind === "transfer" || payment.kind === "bit") && payment.reference) {
    return `אסמכתא: ${payment.reference}`;
  }
  return undefined;
}
