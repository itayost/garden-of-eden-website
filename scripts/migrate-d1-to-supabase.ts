/**
 * Migration script: Import leads from D1 (whatsapp-worker) to Supabase
 *
 * Usage:
 *   npx tsx scripts/migrate-d1-to-supabase.ts <path-to-d1-export.json>
 *
 * Before running:
 *   1. Export D1 data: wrangler d1 export whatsapp-leads --output=leads-dump.json
 *      (or use the Cloudflare dashboard to export as JSON)
 *   2. Place the exported file somewhere accessible
 *
 * Expected JSON format:
 *   {
 *     "leads": [{ phone, name, is_from_haifa, status, note, payment, months, total_payment, flow_age_group, flow_team, flow_frequency, created_at }],
 *     "sent_messages": [{ phone, message_id, message_type, campaign, sent_at }],
 *     "flow_responses": [{ phone, flow_token, screen, data, is_complete, created_at }],
 *     "contact_log": [{ phone, contact_type, rep, notes, outcome, created_at }]
 *   }
 *
 * Run with --dry-run to preview without writing to DB:
 *   npx tsx scripts/migrate-d1-to-supabase.ts leads-dump.json --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// =============================================================================
// Load .env.local (Vercel env pull format)
// =============================================================================

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    val = val.replace(/\\n$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

// =============================================================================
// Types
// =============================================================================

interface D1Lead {
  phone: string;
  name: string;
  is_from_haifa?: boolean | number;
  status?: string;
  note?: string;
  payment?: number;
  months?: number;
  total_payment?: number;
  flow_age_group?: string;
  flow_team?: string;
  flow_frequency?: string;
  created_at?: string;
}

interface D1SentMessage {
  phone: string;
  message_id?: string;
  message_type: string;
  campaign?: string;
  sent_at?: string;
}

interface D1FlowResponse {
  phone: string;
  flow_token?: string;
  screen?: string;
  data?: string | Record<string, unknown>;
  is_complete?: boolean | number;
  created_at?: string;
}

interface D1ContactLog {
  phone: string;
  contact_type: string;
  rep?: string;
  notes?: string;
  outcome?: string;
  created_at?: string;
}

interface D1Export {
  leads: D1Lead[];
  sent_messages?: D1SentMessage[];
  flow_responses?: D1FlowResponse[];
  contact_log?: D1ContactLog[];
}

// =============================================================================
// Main migration
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filePath = args.find((a) => !a.startsWith("--"));

  if (!filePath) {
    console.error("Usage: npx tsx scripts/migrate-d1-to-supabase.ts <path-to-d1-export.json> [--dry-run]");
    process.exit(1);
  }

  // Validate env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // Read export file
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(absolutePath, "utf-8");
  const data: D1Export = JSON.parse(rawData);

  console.log("=== D1 to Supabase Migration ===");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Source: ${absolutePath}`);
  console.log(`Leads: ${data.leads?.length || 0}`);
  console.log(`Sent messages: ${data.sent_messages?.length || 0}`);
  console.log(`Flow responses: ${data.flow_responses?.length || 0}`);
  console.log(`Contact log: ${data.contact_log?.length || 0}`);
  console.log("");

  if (!data.leads || data.leads.length === 0) {
    console.error("No leads found in export file");
    process.exit(1);
  }

  // Create admin Supabase client
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Build phone → UUID map
  const phoneToUUID = new Map<string, string>();
  const stats = {
    leadsInserted: 0,
    leadsSkipped: 0,
    messagesInserted: 0,
    messagesSkipped: 0,
    flowsInserted: 0,
    flowsSkipped: 0,
    contactsInserted: 0,
    contactsSkipped: 0,
    errors: [] as string[],
  };

  // =========================================================================
  // Step 1: Insert leads
  // =========================================================================
  console.log("Step 1: Inserting leads...");
  for (const lead of data.leads) {
    // Normalize phone to 972xxx format
    let phone = lead.phone.replace(/\D/g, "");
    if (phone.startsWith("0")) {
      phone = "972" + phone.slice(1);
    } else if (phone.startsWith("+972")) {
      phone = phone.slice(1);
    }

    // Check for duplicate phone
    if (phoneToUUID.has(phone)) {
      stats.leadsSkipped++;
      continue;
    }

    const uuid = crypto.randomUUID();
    phoneToUUID.set(phone, uuid);

    // Normalize boolean
    const isFromHaifa = lead.is_from_haifa === true || lead.is_from_haifa === 1;

    // Normalize status
    const validStatuses = ["new", "callback", "in_progress", "closed", "disqualified"];
    const status = validStatuses.includes(lead.status || "") ? lead.status : "new";

    if (!dryRun) {
      const { error } = await supabase.from("leads").insert({
        id: uuid,
        phone,
        name: lead.name || "לא ידוע",
        is_from_haifa: isFromHaifa,
        status,
        note: lead.note || null,
        payment: lead.payment ?? null,
        months: lead.months ?? null,
        total_payment: lead.total_payment ?? null,
        flow_age_group: lead.flow_age_group || null,
        flow_team: lead.flow_team || null,
        flow_frequency: lead.flow_frequency || null,
        created_at: lead.created_at || new Date().toISOString(),
      });

      if (error) {
        stats.errors.push(`Lead ${phone}: ${error.message}`);
        stats.leadsSkipped++;
        phoneToUUID.delete(phone);
        continue;
      }
    }

    stats.leadsInserted++;
  }
  console.log(`  Inserted: ${stats.leadsInserted}, Skipped: ${stats.leadsSkipped}`);

  // =========================================================================
  // Step 2: Insert sent messages
  // =========================================================================
  if (data.sent_messages && data.sent_messages.length > 0) {
    console.log("Step 2: Inserting sent messages...");
    for (const msg of data.sent_messages) {
      let phone = msg.phone.replace(/\D/g, "");
      if (phone.startsWith("0")) phone = "972" + phone.slice(1);
      else if (phone.startsWith("+972")) phone = phone.slice(1);

      const leadId = phoneToUUID.get(phone);
      if (!leadId) {
        stats.messagesSkipped++;
        continue;
      }

      const validTypes = ["template", "flow", "text"];
      const messageType = validTypes.includes(msg.message_type) ? msg.message_type : "text";

      if (!dryRun) {
        const { error } = await supabase.from("lead_sent_messages").insert({
          lead_id: leadId,
          message_id: msg.message_id || null,
          message_type: messageType,
          campaign: msg.campaign || null,
          sent_at: msg.sent_at || new Date().toISOString(),
        });

        if (error) {
          stats.errors.push(`SentMessage for ${phone}: ${error.message}`);
          stats.messagesSkipped++;
          continue;
        }
      }

      stats.messagesInserted++;
    }
    console.log(`  Inserted: ${stats.messagesInserted}, Skipped: ${stats.messagesSkipped}`);
  }

  // =========================================================================
  // Step 3: Insert flow responses
  // =========================================================================
  if (data.flow_responses && data.flow_responses.length > 0) {
    console.log("Step 3: Inserting flow responses...");
    for (const flow of data.flow_responses) {
      let phone = flow.phone.replace(/\D/g, "");
      if (phone.startsWith("0")) phone = "972" + phone.slice(1);
      else if (phone.startsWith("+972")) phone = phone.slice(1);

      const leadId = phoneToUUID.get(phone);
      if (!leadId) {
        stats.flowsSkipped++;
        continue;
      }

      // Parse data if it's a string
      let flowData = flow.data;
      if (typeof flowData === "string") {
        try {
          flowData = JSON.parse(flowData);
        } catch {
          flowData = { raw: flowData };
        }
      }

      const isComplete = flow.is_complete === true || flow.is_complete === 1;

      if (!dryRun) {
        const { error } = await supabase.from("lead_flow_responses").insert({
          lead_id: leadId,
          flow_token: flow.flow_token || null,
          screen: flow.screen || null,
          data: flowData || null,
          is_complete: isComplete,
          created_at: flow.created_at || new Date().toISOString(),
        });

        if (error) {
          stats.errors.push(`FlowResponse for ${phone}: ${error.message}`);
          stats.flowsSkipped++;
          continue;
        }
      }

      stats.flowsInserted++;
    }
    console.log(`  Inserted: ${stats.flowsInserted}, Skipped: ${stats.flowsSkipped}`);
  }

  // =========================================================================
  // Step 4: Insert contact log
  // =========================================================================
  if (data.contact_log && data.contact_log.length > 0) {
    console.log("Step 4: Inserting contact log...");
    for (const entry of data.contact_log) {
      let phone = entry.phone.replace(/\D/g, "");
      if (phone.startsWith("0")) phone = "972" + phone.slice(1);
      else if (phone.startsWith("+972")) phone = phone.slice(1);

      const leadId = phoneToUUID.get(phone);
      if (!leadId) {
        stats.contactsSkipped++;
        continue;
      }

      const validContactTypes = ["call", "whatsapp", "meeting", "message_sent"];
      const contactType = validContactTypes.includes(entry.contact_type) ? entry.contact_type : "call";

      const validOutcomes = ["interested", "not_interested", "callback", "no_answer"];
      const outcome = validOutcomes.includes(entry.outcome || "") ? entry.outcome : null;

      if (!dryRun) {
        const { error } = await supabase.from("lead_contact_log").insert({
          lead_id: leadId,
          contact_type: contactType,
          rep: entry.rep || null,
          notes: entry.notes || null,
          outcome,
          created_at: entry.created_at || new Date().toISOString(),
        });

        if (error) {
          stats.errors.push(`ContactLog for ${phone}: ${error.message}`);
          stats.contactsSkipped++;
          continue;
        }
      }

      stats.contactsInserted++;
    }
    console.log(`  Inserted: ${stats.contactsInserted}, Skipped: ${stats.contactsSkipped}`);
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n=== Migration Summary ===");
  console.log(`Leads:         ${stats.leadsInserted} inserted, ${stats.leadsSkipped} skipped`);
  console.log(`Sent Messages: ${stats.messagesInserted} inserted, ${stats.messagesSkipped} skipped`);
  console.log(`Flow Responses: ${stats.flowsInserted} inserted, ${stats.flowsSkipped} skipped`);
  console.log(`Contact Log:   ${stats.contactsInserted} inserted, ${stats.contactsSkipped} skipped`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    for (const err of stats.errors.slice(0, 20)) {
      console.log(`  - ${err}`);
    }
    if (stats.errors.length > 20) {
      console.log(`  ... and ${stats.errors.length - 20} more`);
    }
  }

  // =========================================================================
  // Validation: compare counts
  // =========================================================================
  if (!dryRun) {
    console.log("\n=== Validation ===");

    const { count: leadsCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true });

    const { count: messagesCount } = await supabase
      .from("lead_sent_messages")
      .select("*", { count: "exact", head: true });

    const { count: flowsCount } = await supabase
      .from("lead_flow_responses")
      .select("*", { count: "exact", head: true });

    const { count: contactsCount } = await supabase
      .from("lead_contact_log")
      .select("*", { count: "exact", head: true });

    console.log(`Supabase leads:         ${leadsCount}`);
    console.log(`Supabase sent_messages: ${messagesCount}`);
    console.log(`Supabase flow_responses: ${flowsCount}`);
    console.log(`Supabase contact_log:   ${contactsCount}`);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
