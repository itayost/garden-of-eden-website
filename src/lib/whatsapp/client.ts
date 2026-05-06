import { AGE_GROUPS } from "./flow-constants";
import { callWhatsAppAPI, getConfig, type WhatsAppResult } from "./api";

export type { WhatsAppResult } from "./api";

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

export async function sendFlowTemplate(
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
    type: "template",
    template: {
      name: "provide_details_template",
      language: { code: "he" },
      components: [
        {
          type: "header",
          parameters: [{ type: "text", text: name || "חבר/ה" }],
        },
        {
          type: "button",
          sub_type: "flow",
          index: "0",
          parameters: [
            {
              type: "action",
              action: {
                flow_token: flowToken,
                flow_action_data: {
                  customer_name: name || "חבר/ה",
                  age_groups: AGE_GROUPS,
                },
              },
            },
          ],
        },
      ],
    },
  });

  if (result.success) {
    return { ...result, flowToken };
  }
  return result;
}
