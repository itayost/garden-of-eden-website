import { NextRequest, NextResponse } from "next/server";
import {
  decryptFlowRequest,
  encryptFlowResponse,
} from "@/lib/whatsapp/encryption";
import {
  AGE_GROUPS,
  TEAMS,
  FREQUENCY_OPTIONS,
} from "@/lib/whatsapp/flow-constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";

const FLOW_VERSION = "3.0";

/**
 * WhatsApp Flow data_exchange endpoint
 *
 * Handles encrypted flow requests from WhatsApp,
 * navigates between screens, and saves flow responses to the DB.
 *
 * Screen flow: INIT → AGE_SELECTION → TEAM_SELECTION → FREQUENCY_SELECTION → CONFIRMATION → SUCCESS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle unencrypted ping (return base64-encoded JSON like original worker)
    if (body.action === "ping") {
      const responseData = { version: FLOW_VERSION, data: { status: "active" } };
      const base64 = Buffer.from(JSON.stringify(responseData)).toString("base64");
      return new NextResponse(base64, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const privateKeyPem = process.env.WHATSAPP_FLOW_PRIVATE_KEY?.trim();
    if (!privateKeyPem) {
      console.error("[WhatsApp Flow] WHATSAPP_FLOW_PRIVATE_KEY not configured");
      return NextResponse.json(
        { error: "Flow encryption not configured" },
        { status: 500 }
      );
    }

    // Replace literal \n with actual newlines (Vercel env format)
    const privateKey = privateKeyPem.replace(/\\n/g, "\n");

    let decrypted;
    try {
      decrypted = decryptFlowRequest(body, privateKey);
    } catch (decryptError) {
      // Per Meta docs: return 421 when decryption fails
      console.error("[WhatsApp Flow] Decryption failed:", decryptError);
      return NextResponse.json(
        { error: "RSA-OAEP failed encrypt/decrypt." },
        { status: 421 }
      );
    }

    const { decryptedData, aesKeyBuffer, initialVectorBuffer } = decrypted;
    const action = decryptedData.action as string;
    const screen = decryptedData.screen as string | undefined;
    const data = (decryptedData.data as Record<string, unknown>) || {};
    const flowToken = decryptedData.flow_token as string;

    console.log("[WhatsApp Flow] Processing:", { action, screen, flowToken });

    let responseData: Record<string, unknown>;

    // Handle encrypted ping (health check)
    if (action === "ping") {
      responseData = {
        version: FLOW_VERSION,
        data: { status: "active" },
      };
    } else if (action === "INIT") {
      responseData = await handleInit(flowToken);
    } else if (action === "BACK") {
      responseData = handleBack(screen);
    } else if (action === "data_exchange") {
      responseData = await handleDataExchange(screen, data, flowToken);
    } else {
      console.error("[WhatsApp Flow] Unknown action:", action);
      responseData = await handleInit(flowToken);
    }

    const encrypted = encryptFlowResponse(
      responseData,
      aesKeyBuffer,
      initialVectorBuffer
    );
    return new NextResponse(encrypted, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    // Per Meta docs: return 421 for any processing errors
    console.error("[WhatsApp Flow] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 421 }
    );
  }
}

/**
 * INIT → return AGE_SELECTION screen with customer name
 */
async function handleInit(
  flowToken: string
): Promise<Record<string, unknown>> {
  const phone = flowToken.split("_")[1] || "";
  let customerName = "חבר/ה";

  if (/^972\d{9}$/.test(phone)) {
    try {
      const supabase = createAdminClient();
      const { data: lead } = await typedFrom(supabase, "leads")
        .select("name")
        .eq("phone", phone)
        .maybeSingle();
      if (lead?.name) customerName = lead.name;
    } catch {
      // Ignore — use default name
    }
  }

  return {
    version: FLOW_VERSION,
    screen: "AGE_SELECTION",
    data: {
      customer_name: customerName,
      age_groups: AGE_GROUPS,
    },
  };
}

/**
 * Handle data_exchange action — route to next screen based on current screen
 */
async function handleDataExchange(
  currentScreen: string | undefined,
  data: Record<string, unknown>,
  flowToken: string
): Promise<Record<string, unknown>> {
  switch (currentScreen) {
    case "AGE_SELECTION":
      return {
        version: FLOW_VERSION,
        screen: "TEAM_SELECTION",
        data: {
          teams: TEAMS,
          show_other_field: false,
        },
      };

    case "TEAM_SELECTION":
      // If "other" selected but no text provided, stay on screen
      if (data.team === "team_other" && !data.other_team) {
        return {
          version: FLOW_VERSION,
          screen: "TEAM_SELECTION",
          data: {
            teams: TEAMS,
            show_other_field: true,
          },
        };
      }
      return {
        version: FLOW_VERSION,
        screen: "FREQUENCY_SELECTION",
        data: {
          frequency_options: FREQUENCY_OPTIONS,
        },
      };

    case "FREQUENCY_SELECTION":
      await saveFlowData(data, flowToken);
      return {
        version: FLOW_VERSION,
        screen: "CONFIRMATION",
        data: {
          website_url: "https://www.edengarden.co.il/",
        },
      };

    case "CONFIRMATION":
      return {
        version: FLOW_VERSION,
        screen: "SUCCESS",
        data: {
          extension_message_response: {
            params: {
              flow_token: flowToken,
              status: "completed",
            },
          },
        },
      };

    default:
      console.error("[WhatsApp Flow] Unknown screen:", currentScreen);
      return {
        version: FLOW_VERSION,
        screen: "AGE_SELECTION",
        data: {
          customer_name: "חבר/ה",
          age_groups: AGE_GROUPS,
        },
      };
  }
}

/**
 * BACK → navigate to previous screen
 */
function handleBack(
  currentScreen: string | undefined
): Record<string, unknown> {
  switch (currentScreen) {
    case "TEAM_SELECTION":
      return {
        version: FLOW_VERSION,
        screen: "AGE_SELECTION",
        data: {
          customer_name: "חבר/ה",
          age_groups: AGE_GROUPS,
        },
      };
    case "FREQUENCY_SELECTION":
      return {
        version: FLOW_VERSION,
        screen: "TEAM_SELECTION",
        data: {
          teams: TEAMS,
          show_other_field: false,
        },
      };
    case "CONFIRMATION":
      return {
        version: FLOW_VERSION,
        screen: "FREQUENCY_SELECTION",
        data: {
          frequency_options: FREQUENCY_OPTIONS,
        },
      };
    default:
      return {
        version: FLOW_VERSION,
        screen: "AGE_SELECTION",
        data: {
          customer_name: "חבר/ה",
          age_groups: AGE_GROUPS,
        },
      };
  }
}

/**
 * Save flow data to Supabase — update lead and log flow response
 */
async function saveFlowData(
  data: Record<string, unknown>,
  flowToken: string
): Promise<void> {
  const phone = flowToken.split("_")[1] || "";
  if (!/^972\d{9}$/.test(phone)) return;

  try {
    const supabase = createAdminClient();

    const { data: lead } = await typedFrom(supabase, "leads")
      .select("id")
      .eq("phone", phone)
      .single();

    if (!lead) return;

    await typedFrom(supabase, "leads")
      .update({
        flow_age_group: data.age_group as string,
        flow_team: data.team as string,
        flow_frequency: data.frequency as string,
      })
      .eq("id", lead.id);

    await typedFrom(supabase, "lead_flow_responses").upsert(
      {
        flow_token: flowToken,
        lead_id: lead.id,
        screen: "COMPLETE",
        data: {
          age_group: data.age_group,
          team: data.team,
          frequency: data.frequency,
        },
        is_complete: true,
      },
      { onConflict: "flow_token" }
    );
  } catch (error) {
    console.error("[WhatsApp Flow] Error saving flow data:", error);
  }
}
