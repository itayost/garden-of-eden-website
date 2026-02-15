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
      responseData = handleInit();
    } else if (screen === "AGE_SELECTION") {
      responseData = handleAgeSelection(data);
    } else if (screen === "TEAM_SELECTION") {
      responseData = handleTeamSelection(data);
    } else if (screen === "FREQUENCY_SELECTION") {
      responseData = await handleFrequencySelection(data, flowToken);
    } else {
      console.error("[WhatsApp Flow] Unknown screen:", screen);
      responseData = handleInit();
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

function handleInit(): Record<string, unknown> {
  return {
    screen: "AGE_SELECTION",
    data: {
      age_groups: AGE_GROUPS,
    },
  };
}

function handleAgeSelection(
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    screen: "TEAM_SELECTION",
    data: {
      selected_age_group: data.age_group,
      teams: TEAMS,
    },
  };
}

function handleTeamSelection(
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    screen: "FREQUENCY_SELECTION",
    data: {
      selected_team: data.team,
      frequency_options: FREQUENCY_OPTIONS,
    },
  };
}

async function handleFrequencySelection(
  data: Record<string, unknown>,
  flowToken: string
): Promise<Record<string, unknown>> {
  // Extract phone from flow token: session_{phone}_{timestamp}_{random}
  const tokenParts = flowToken.split("_");
  const phone = tokenParts[1] || "";

  // Validate phone format before DB query
  if (!/^972\d{9}$/.test(phone)) {
    console.error("[WhatsApp Flow] Invalid phone in flow token:", flowToken);
    return {
      screen: "CONFIRMATION",
      data: {
        extension_message_response: {
          params: { flow_token: flowToken, status: "completed" },
        },
      },
    };
  }

  try {
    const supabase = createAdminClient();

    // Find lead by phone
    const { data: lead } = await typedFrom(supabase, "leads")
      .select("id")
      .eq("phone", phone)
      .single();

    if (lead) {
      // Update lead with flow data
      await typedFrom(supabase, "leads")
        .update({
          flow_age_group: data.age_group as string,
          flow_team: data.team as string,
          flow_frequency: data.frequency as string,
        })
        .eq("id", lead.id);

      // Upsert flow response as complete
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

  return {
    screen: "CONFIRMATION",
    data: {
      extension_message_response: {
        params: { flow_token: flowToken, status: "completed" },
      },
    },
  };
}
