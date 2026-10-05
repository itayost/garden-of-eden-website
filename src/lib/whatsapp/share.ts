import type { WhatsAppResult } from "./api";

/**
 * A chat opened on the staff member's (or child's) own WhatsApp, with the
 * text ready: how a message goes out while its Meta template waits for
 * approval.
 */
export function waShareUrl(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}

/** The plan_confirmed template's words, for sending by hand. */
export function planConfirmedText(params: {
  parentName: string;
  childName: string;
  planName: string;
  validity: string;
  agreementUrl: string;
}): string {
  return [
    `היי ${params.parentName}, הרישום של ${params.childName} למסלול ${params.planName} בגארדן אוף עדן קריית אתא נקלט.`,
    params.validity ? `המסלול בתוקף עד ${params.validity}.` : "",
    `לצפייה ולחתימה על הסכם ההרשמה: ${params.agreementUrl}`,
    "אם משהו לא מדויק, כתבו לנו כאן.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The template is not set yet (it waits for Meta): send by hand instead. */
export function templateMissing(result: WhatsAppResult | null): boolean {
  return Boolean(result && !result.success && result.error?.includes("not configured"));
}
