import "server-only";

import { verifyAdmin } from "@/lib/actions/shared";
import { isPelecardConfigured } from "./pelecard";

/**
 * Whether parents may sign up and pay on /join. Setting the Pelecard
 * credentials is not enough: ONLINE_PAYMENTS=on opens the flow on purpose,
 * after the first live charge worked. Until then parents see a WhatsApp
 * notice before the form, so no agreement or medical detail is collected
 * for a payment that cannot happen.
 */
export function onlinePaymentsOpen(): boolean {
  return isPelecardConfigured() && process.env.ONLINE_PAYMENTS?.trim() === "on";
}

/**
 * Open to everyone once switched on. Before that an admin may pass, so the
 * first live charge can be made on the real terminal while parents still see
 * the notice. Checked again in each server action, not only on the page.
 */
export async function canPayOnline(): Promise<boolean> {
  if (onlinePaymentsOpen()) return true;
  if (!isPelecardConfigured()) return false;
  const { error } = await verifyAdmin();
  return !error;
}

export const PAYMENTS_CLOSED_MESSAGE =
  "ההרשמה והתשלום באתר ייפתחו בקרוב. בינתיים נשמח להשלים את ההרשמה בוואטסאפ 052-577-9446.";
