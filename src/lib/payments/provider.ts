/**
 * What the site asks of a card acquirer. One adapter per provider; the charge
 * action only knows this shape, so swapping or adding a provider never
 * touches the order flow.
 */
export interface CardChargeRequest {
  /** Our order id, sent as the merchant reference. */
  orderId: string;
  amountIls: number;
  installments: number;
  description: string;
  card: {
    number: string;
    expMonth: number;
    expYear: number;
    cvv: string;
    holderName: string;
    holderId: string;
  };
  payer: { name: string; phone: string; email: string | null };
}

export type CardChargeResult =
  | {
      ok: true;
      transactionId: string;
      approvalNumber: string | null;
      /** Whatever the provider returned, minus card data. Stored for support. */
      raw: unknown;
    }
  | {
      ok: false;
      /** Shown to the parent, in Hebrew. */
      message: string;
      code: "declined" | "not_configured" | "error";
    };
