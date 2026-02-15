const GRAPH_API_URL = "https://graph.facebook.com/v18.0";

interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  flowId?: string;
}

function getConfig(): WhatsAppConfig {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const flowId = process.env.WHATSAPP_FLOW_ID?.trim();
  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp environment variables not configured");
  }
  return { token, phoneNumberId, flowId };
}

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  flowToken?: string;
  error?: string;
}

async function callWhatsAppAPI(
  phoneNumberId: string,
  token: string,
  body: Record<string, unknown>
): Promise<WhatsAppResult> {
  const response = await fetch(
    `${GRAPH_API_URL}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    let errorMessage = "WhatsApp API error";
    try {
      const error = await response.json();
      console.error("WhatsApp API error:", error);
      errorMessage = error?.error?.message || errorMessage;
    } catch {
      console.error("WhatsApp API error: status", response.status);
    }
    return { success: false, error: errorMessage };
  }

  const data = await response.json();
  return { success: true, messageId: data.messages?.[0]?.id };
}

export async function sendTemplateMessage(
  phone: string,
  templateName: string
): Promise<WhatsAppResult> {
  const { token, phoneNumberId } = getConfig();
  return callWhatsAppAPI(phoneNumberId, token, {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: { name: templateName, language: { code: "he" } },
  });
}

export async function sendTextMessage(
  phone: string,
  text: string
): Promise<WhatsAppResult> {
  const { token, phoneNumberId } = getConfig();
  return callWhatsAppAPI(phoneNumberId, token, {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body: text },
  });
}

export async function sendFlowInteractive(
  phone: string,
  name: string
): Promise<WhatsAppResult> {
  const { token, phoneNumberId, flowId } = getConfig();
  if (!flowId) {
    return { success: false, error: "WHATSAPP_FLOW_ID not configured" };
  }

  const flowToken = `session_${phone}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const result = await callWhatsAppAPI(phoneNumberId, token, {
    messaging_product: "whatsapp",
    to: phone,
    type: "interactive",
    interactive: {
      type: "flow",
      header: { type: "text", text: "Garden of Eden" },
      body: {
        text: `שלום ${name}, נשמח לשמוע ממך! מלא את הפרטים הבאים:`,
      },
      footer: { text: "Garden of Eden Football Academy" },
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_action: "data_exchange",
          flow_token: flowToken,
          flow_id: flowId,
          flow_cta: "מלא פרטים",
        },
      },
    },
  });

  if (result.success) {
    return { ...result, flowToken };
  }
  return result;
}
