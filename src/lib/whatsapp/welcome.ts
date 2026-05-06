import { callWhatsAppAPI, getConfig, type WhatsAppResult } from "./api";

const DEFAULT_NAME = "חבר/ה";

export async function sendWelcomeMessage(
  phone: string,
  fullName: string | null
): Promise<WhatsAppResult> {
  const templateName = process.env.WHATSAPP_WELCOME_TEMPLATE_NAME?.trim();
  if (!templateName) {
    return {
      success: false,
      error: "WHATSAPP_WELCOME_TEMPLATE_NAME not configured",
    };
  }

  const { token, phoneNumberId } = getConfig();

  return callWhatsAppAPI(phoneNumberId, token, {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "he" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: fullName?.trim() || DEFAULT_NAME },
          ],
        },
      ],
    },
  });
}
