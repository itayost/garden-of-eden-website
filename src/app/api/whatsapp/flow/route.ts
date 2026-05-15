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
import { isLeadPhone } from "@/types/leads";

const FLOW_VERSION = "3.0";
const DEFAULT_CUSTOMER_NAME = "חבר/ה";

// Screen builders — single source of truth for each Flow screen payload.
function ageSelectionScreen(customerName: string = DEFAULT_CUSTOMER_NAME) {
  return {
    version: FLOW_VERSION,
    screen: "AGE_SELECTION" as const,
    data: { customer_name: customerName, age_groups: AGE_GROUPS },
  };
}

function teamSelectionScreen(showOtherField: boolean = false) {
  return {
    version: FLOW_VERSION,
    screen: "TEAM_SELECTION" as const,
    data: { teams: TEAMS, show_other_field: showOtherField },
  };
}

function frequencySelectionScreen() {
  return {
    version: FLOW_VERSION,
    screen: "FREQUENCY_SELECTION" as const,
    data: { frequency_options: FREQUENCY_OPTIONS },
  };
}

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
  let customerName = DEFAULT_CUSTOMER_NAME;

  if (isLeadPhone(phone)) {
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

  return ageSelectionScreen(customerName);
}

/**
 * Handle data_exchange action — route to next screen based on current screen
 *
 * Each screen transition only receives the CURRENT screen's form data,
 * so we save incrementally at each step (matching the worker pattern).
 */
async function handleDataExchange(
  currentScreen: string | undefined,
  data: Record<string, unknown>,
  flowToken: string
): Promise<Record<string, unknown>> {
  const phone = extractPhoneFromToken(flowToken);
  console.log("[WhatsApp Flow] Data exchange:", { currentScreen, data, phone });

  switch (currentScreen) {
    case "AGE_SELECTION":
      // Save age immediately
      if (phone) {
        await saveFlowField(phone, { flow_age_group: data.age as string });
      }
      return teamSelectionScreen();

    case "TEAM_SELECTION": {
      // If "other" selected but no text provided, stay on screen
      if (data.team === "team_other" && !data.other_team) {
        return teamSelectionScreen(true);
      }
      // Save team immediately (use other_team text if "other" selected)
      if (phone) {
        const teamValue =
          data.team === "team_other"
            ? (data.other_team as string)
            : (data.team as string);
        await saveFlowField(phone, { flow_team: teamValue });
        // Mirror to admin-editable `club` only when not already set
        await saveLeadClubIfEmpty(phone, teamValue);
      }
      return frequencySelectionScreen();
    }

    case "FREQUENCY_SELECTION":
      // Save frequency and mark flow complete
      if (phone) {
        await saveFlowField(phone, { flow_frequency: data.frequency as string });
        await saveFlowResponse(phone, flowToken, data);
      }
      return {
        version: FLOW_VERSION,
        screen: "CONFIRMATION",
        data: { website_url: "https://www.edengarden.co.il/" },
      };

    case "CONFIRMATION":
      return {
        version: FLOW_VERSION,
        screen: "SUCCESS",
        data: {
          extension_message_response: {
            params: { flow_token: flowToken, status: "completed" },
          },
        },
      };

    default:
      console.error("[WhatsApp Flow] Unknown screen:", currentScreen);
      return ageSelectionScreen();
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
      return ageSelectionScreen();
    case "FREQUENCY_SELECTION":
      return teamSelectionScreen();
    case "CONFIRMATION":
      return frequencySelectionScreen();
    default:
      return ageSelectionScreen();
  }
}

/**
 * Extract phone number from flow token (format: session_972XXXXXXXXX_timestamp_random)
 */
function extractPhoneFromToken(flowToken: string): string | null {
  const match = flowToken?.match(/session_(\d+)_/);
  return match ? match[1] : null;
}

/**
 * Save a single flow field to the lead record (incremental update)
 */
async function saveFlowField(
  phone: string,
  fields: Record<string, string>
): Promise<void> {
  if (!isLeadPhone(phone)) return;

  try {
    const supabase = createAdminClient();
    const { error } = await typedFrom(supabase, "leads")
      .update(fields)
      .eq("phone", phone);

    if (error) {
      console.error("[WhatsApp Flow] Error saving field:", error);
    } else {
      console.log("[WhatsApp Flow] Saved fields for", phone, ":", fields);
    }
  } catch (error) {
    console.error("[WhatsApp Flow] Error saving flow field:", error);
  }
}

/**
 * Mirror flow_team into the admin-editable `club` column, but only when it is
 * currently NULL. This preserves any admin edit made between webhook creation
 * and flow completion.
 */
async function saveLeadClubIfEmpty(phone: string, club: string): Promise<void> {
  if (!isLeadPhone(phone) || !club) return;
  try {
    const supabase = createAdminClient();
    const { error } = await typedFrom(supabase, "leads")
      .update({ club })
      .eq("phone", phone)
      .is("club", null);
    if (error) {
      console.error("[WhatsApp Flow] Error saving club:", error);
    }
  } catch (error) {
    console.error("[WhatsApp Flow] Error saving club:", error);
  }
}

/**
 * Save complete flow response record
 */
async function saveFlowResponse(
  phone: string,
  flowToken: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!isLeadPhone(phone)) return;

  try {
    const supabase = createAdminClient();

    const { data: lead } = await typedFrom(supabase, "leads")
      .select("id")
      .eq("phone", phone)
      .single();

    if (!lead) return;

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
    console.error("[WhatsApp Flow] Error saving flow response:", error);
  }
}
