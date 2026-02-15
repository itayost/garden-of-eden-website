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

    // Handle unencrypted ping
    if (body.action === "ping") {
      return NextResponse.json({ status: "active" });
    }

    const privateKeyPem = process.env.WHATSAPP_FLOW_PRIVATE_KEY?.trim();
    if (!privateKeyPem) {
      console.error("[WhatsApp Flow] WHATSAPP_FLOW_PRIVATE_KEY not configured");
      return NextResponse.json(
        { error: "Flow encryption not configured" },
        { status: 500 }
      );
    }

    // Replace literal \n with actual newlines
    const privateKey = privateKeyPem.replace(/\\n/g, "\n");

    const { decryptedData, aesKeyBuffer, initialVectorBuffer } =
      decryptFlowRequest(body, privateKey);

    const action = decryptedData.action as string;
    const screen = decryptedData.screen as string | undefined;
    const data = (decryptedData.data as Record<string, unknown>) || {};
    const flowToken = decryptedData.flow_token as string;

    let responseData: Record<string, unknown>;

    if (action === "INIT") {
      responseData = await handleInit(flowToken);
    } else if (action === "BACK") {
      responseData = handleBack(screen);
    } else if (screen === "AGE_SELECTION") {
      responseData = handleAgeSelection();
    } else if (screen === "TEAM_SELECTION") {
      responseData = handleTeamSelection();
    } else if (screen === "FREQUENCY_SELECTION") {
      responseData = await handleFrequencySelection(data, flowToken);
    } else if (screen === "CONFIRMATION") {
      responseData = handleConfirmation(flowToken);
    } else {
      console.error("[WhatsApp Flow] Unknown action/screen:", action, screen);
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
    console.error("[WhatsApp Flow] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * INIT → return AGE_SELECTION screen with customer name
 */
async function handleInit(
  flowToken: string
): Promise<Record<string, unknown>> {
  // Extract phone from flow token: session_{phone}_{timestamp}_{random}
  const phone = flowToken.split("_")[1] || "";
  let customerName = "";

  if (/^972\d{9}$/.test(phone)) {
    try {
      const supabase = createAdminClient();
      const { data: lead } = await typedFrom(supabase, "leads")
        .select("name")
        .eq("phone", phone)
        .maybeSingle();
      customerName = lead?.name || "";
    } catch {
      // Ignore — use empty name
    }
  }

  return {
    screen: "AGE_SELECTION",
    data: {
      customer_name: customerName,
      age_groups: AGE_GROUPS,
    },
  };
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
        screen: "AGE_SELECTION",
        data: {
          customer_name: "",
          age_groups: AGE_GROUPS,
        },
      };
    case "FREQUENCY_SELECTION":
      return {
        screen: "TEAM_SELECTION",
        data: {
          teams: TEAMS,
          show_other_field: false,
        },
      };
    case "CONFIRMATION":
      return {
        screen: "FREQUENCY_SELECTION",
        data: {
          frequency_options: FREQUENCY_OPTIONS,
        },
      };
    default:
      return {
        screen: "AGE_SELECTION",
        data: {
          customer_name: "",
          age_groups: AGE_GROUPS,
        },
      };
  }
}

/**
 * AGE_SELECTION submit → return TEAM_SELECTION
 */
function handleAgeSelection(): Record<string, unknown> {
  return {
    screen: "TEAM_SELECTION",
    data: {
      teams: TEAMS,
      show_other_field: false,
    },
  };
}

/**
 * TEAM_SELECTION submit → return FREQUENCY_SELECTION
 */
function handleTeamSelection(): Record<string, unknown> {
  return {
    screen: "FREQUENCY_SELECTION",
    data: {
      frequency_options: FREQUENCY_OPTIONS,
    },
  };
}

/**
 * FREQUENCY_SELECTION submit → save flow data, return CONFIRMATION
 */
async function handleFrequencySelection(
  data: Record<string, unknown>,
  flowToken: string
): Promise<Record<string, unknown>> {
  // Extract phone from flow token: session_{phone}_{timestamp}_{random}
  const phone = flowToken.split("_")[1] || "";

  if (/^972\d{9}$/.test(phone)) {
    try {
      const supabase = createAdminClient();

      const { data: lead } = await typedFrom(supabase, "leads")
        .select("id")
        .eq("phone", phone)
        .single();

      if (lead) {
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
            screen: "FREQUENCY_SELECTION",
            data: {
              age_group: data.age_group,
              team: data.team,
              frequency: data.frequency,
            },
            is_complete: true,
          },
          { onConflict: "flow_token" }
        );
      }
    } catch (error) {
      console.error("[WhatsApp Flow] Error saving flow data:", error);
    }
  }

  return {
    screen: "CONFIRMATION",
    data: {
      website_url: "https://www.edengarden.co.il/",
    },
  };
}

/**
 * CONFIRMATION submit → return SUCCESS (closes the flow)
 */
function handleConfirmation(flowToken: string): Record<string, unknown> {
  return {
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
}
