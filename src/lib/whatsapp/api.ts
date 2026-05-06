const GRAPH_API_URL = "https://graph.facebook.com/v21.0";

export interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  flowId?: string;
}

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  flowToken?: string;
  error?: string;
}

export function getConfig(): WhatsAppConfig {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const flowId = process.env.WHATSAPP_FLOW_ID?.trim();
  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp environment variables not configured");
  }
  return { token, phoneNumberId, flowId };
}

export async function callWhatsAppAPI(
  phoneNumberId: string,
  token: string,
  body: Record<string, unknown>
): Promise<WhatsAppResult> {
  const url = `${GRAPH_API_URL}/${phoneNumberId}/messages`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  const responseText = await response.text();
  clearTimeout(timeoutId);

  if (!response.ok) {
    let errorMessage = `WhatsApp API error (${response.status})`;
    try {
      const error = JSON.parse(responseText);
      const meta = error?.error;
      if (meta) {
        errorMessage = `[${meta.code || response.status}] ${meta.message || "Unknown error"}`;
        if (meta.error_data?.details) {
          errorMessage += ` — ${meta.error_data.details}`;
        }
      }
    } catch {
      errorMessage += ` — ${responseText}`;
    }
    return { success: false, error: errorMessage };
  }

  const data = JSON.parse(responseText);
  const messageId = data.messages?.[0]?.id;
  return { success: true, messageId };
}
