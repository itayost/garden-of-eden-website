import { callWhatsAppAPI, getConfig, type WhatsAppResult } from "./api";

interface PlanConfirmedParams {
  parentName: string;
  childName: string;
  planName: string;
  /** {{4}} after "המסלול בתוקף עד": the end date, plus the start when the Plan waits in the queue (validityText). */
  validity: string;
  agreementUrl: string;
}

function templateMessage(
  phone: string,
  templateName: string,
  parameters: readonly string[],
): Record<string, unknown> {
  return {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "he" },
      components: [
        {
          type: "body",
          parameters: parameters.map((text) => ({ type: "text", text })),
        },
      ],
    },
  };
}

/**
 * Meta-approved template WHATSAPP_PLAN_CONFIRMED_TEMPLATE_NAME with body
 * parameters {{1}} parent, {{2}} child, {{3}} plan, {{4}} validity, {{5}} link.
 */
export async function sendPlanConfirmed(
  phone: string,
  params: PlanConfirmedParams,
): Promise<WhatsAppResult> {
  const templateName = process.env.WHATSAPP_PLAN_CONFIRMED_TEMPLATE_NAME?.trim();
  if (!templateName) {
    return { success: false, error: "WHATSAPP_PLAN_CONFIRMED_TEMPLATE_NAME not configured" };
  }
  const { token, phoneNumberId } = getConfig();
  return callWhatsAppAPI(
    phoneNumberId,
    token,
    templateMessage(phone, templateName, [
      params.parentName,
      params.childName,
      params.planName,
      params.validity,
      params.agreementUrl,
    ]),
  );
}

interface BookingReminderParams {
  traineeName: string;
  /** HH:MM */
  time: string;
  trainerName: string;
  place: string;
}

/**
 * Meta-approved template WHATSAPP_BOOKING_REMINDER_TEMPLATE_NAME with body
 * parameters {{1}} trainee, {{2}} time, {{3}} trainer, {{4}} place. Sent
 * the evening before a self-booked training.
 */
export async function sendBookingReminder(
  phone: string,
  params: BookingReminderParams,
): Promise<WhatsAppResult> {
  const templateName = process.env.WHATSAPP_BOOKING_REMINDER_TEMPLATE_NAME?.trim();
  if (!templateName) {
    return { success: false, error: "WHATSAPP_BOOKING_REMINDER_TEMPLATE_NAME not configured" };
  }
  const { token, phoneNumberId } = getConfig();
  return callWhatsAppAPI(
    phoneNumberId,
    token,
    templateMessage(phone, templateName, [params.traineeName, params.time, params.trainerName, params.place]),
  );
}

interface PlanReminderParams {
  parentName: string;
  childName: string;
  planName: string;
  /** "מסתיים בעוד 3 ימים", "נותר אימון אחד", "הסתיים" */
  reason: string;
  renewUrl: string;
}

/**
 * Meta-approved template WHATSAPP_PLAN_REMINDER_TEMPLATE_NAME with body
 * parameters {{1}} parent, {{2}} child, {{3}} plan, {{4}} reason, {{5}} link.
 */
export async function sendPlanReminder(
  phone: string,
  params: PlanReminderParams,
): Promise<WhatsAppResult> {
  const templateName = process.env.WHATSAPP_PLAN_REMINDER_TEMPLATE_NAME?.trim();
  if (!templateName) {
    return { success: false, error: "WHATSAPP_PLAN_REMINDER_TEMPLATE_NAME not configured" };
  }
  const { token, phoneNumberId } = getConfig();
  return callWhatsAppAPI(
    phoneNumberId,
    token,
    templateMessage(phone, templateName, [
      params.parentName,
      params.childName,
      params.planName,
      params.reason,
      params.renewUrl,
    ]),
  );
}

interface PaymentLinkParams {
  parentName: string;
  childName: string;
  planName: string;
  /** "₪450" */
  amount: string;
  url: string;
}

/**
 * A Payment link from staff: Meta-approved template
 * WHATSAPP_PAYMENT_LINK_TEMPLATE_NAME with body parameters {{1}} parent,
 * {{2}} child, {{3}} plan, {{4}} amount, {{5}} link. Optional until Meta
 * approves it; staff can always copy the link.
 */
export async function sendPaymentLink(phone: string, params: PaymentLinkParams): Promise<WhatsAppResult> {
  const templateName = process.env.WHATSAPP_PAYMENT_LINK_TEMPLATE_NAME?.trim();
  if (!templateName) {
    return { success: false, error: "WHATSAPP_PAYMENT_LINK_TEMPLATE_NAME not configured" };
  }
  const { token, phoneNumberId } = getConfig();
  return callWhatsAppAPI(
    phoneNumberId,
    token,
    templateMessage(phone, templateName, [params.parentName, params.childName, params.planName, params.amount, params.url]),
  );
}

/**
 * A trainee asked the parent to buy a Plan: Meta-approved template
 * WHATSAPP_PURCHASE_REQUEST_TEMPLATE_NAME with body parameters {{1}} parent,
 * {{2}} child, {{3}} link.
 */
export async function sendPurchaseRequest(
  phone: string,
  params: { parentName: string; childName: string; url: string },
): Promise<WhatsAppResult> {
  const templateName = process.env.WHATSAPP_PURCHASE_REQUEST_TEMPLATE_NAME?.trim();
  if (!templateName) {
    return { success: false, error: "WHATSAPP_PURCHASE_REQUEST_TEMPLATE_NAME not configured" };
  }
  const { token, phoneNumberId } = getConfig();
  return callWhatsAppAPI(phoneNumberId, token, templateMessage(phone, templateName, [params.parentName, params.childName, params.url]));
}

const weeklyReportTemplateName = () => process.env.WHATSAPP_WEEKLY_REPORT_TEMPLATE_NAME?.trim() || null;
const missedYouTemplateName = () => process.env.WHATSAPP_MISSED_YOU_TEMPLATE_NAME?.trim() || null;

/**
 * Whether the template a sent Weekly report ("report") or "התגעגענו"
 * ("missed_you") goes to the parent on is named. Until Meta approves it the
 * send job skips the parent part and the queue says why.
 */
export function weeklyTemplateConfigured(kind: "report" | "missed_you"): boolean {
  const name = kind === "report" ? weeklyReportTemplateName() : missedYouTemplateName();
  return name !== null;
}

/**
 * A Weekly report was sent: Meta-approved template
 * WHATSAPP_WEEKLY_REPORT_TEMPLATE_NAME with body parameters {{1}} the
 * child's first name, {{2}} the report link.
 */
export async function sendWeeklyReport(
  phone: string,
  params: { childName: string; reportUrl: string },
): Promise<WhatsAppResult> {
  const templateName = weeklyReportTemplateName();
  if (!templateName) {
    return { success: false, error: "WHATSAPP_WEEKLY_REPORT_TEMPLATE_NAME not configured" };
  }
  const { token, phoneNumberId } = getConfig();
  return callWhatsAppAPI(phoneNumberId, token, templateMessage(phone, templateName, [params.childName, params.reportUrl]));
}

/**
 * "התגעגענו" to the parent of a Trainee who stopped coming: Meta-approved
 * template WHATSAPP_MISSED_YOU_TEMPLATE_NAME with body parameter {{1}} the
 * child's first name.
 */
export async function sendMissedYou(phone: string, params: { childName: string }): Promise<WhatsAppResult> {
  const templateName = missedYouTemplateName();
  if (!templateName) {
    return { success: false, error: "WHATSAPP_MISSED_YOU_TEMPLATE_NAME not configured" };
  }
  const { token, phoneNumberId } = getConfig();
  return callWhatsAppAPI(phoneNumberId, token, templateMessage(phone, templateName, [params.childName]));
}
