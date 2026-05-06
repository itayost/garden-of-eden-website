import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeMessage } from "./welcome";

const DISPATCH_BATCH_SIZE = 100;

export type DispatchResult = {
  attempted: number;
  sent: number;
  failed: number;
};

export async function dispatchPendingWelcomes(): Promise<DispatchResult> {
  const result: DispatchResult = { attempted: 0, sent: 0, failed: 0 };
  const supabase = createAdminClient();

  const { data: pending, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .is("welcome_message_sent_at", null)
    .not("arbox_user_id", "is", null)
    .not("phone", "is", null)
    .order("created_at", { ascending: true })
    .limit(DISPATCH_BATCH_SIZE);

  if (error) {
    console.error("[Welcome Dispatch] Lookup failed:", error);
    throw error;
  }

  if (!pending || pending.length === 0) {
    console.log("[Welcome Dispatch] No pending welcomes");
    return result;
  }

  console.log(`[Welcome Dispatch] Sending ${pending.length} welcome(s)`);

  for (const row of pending) {
    if (!row.phone) continue;
    result.attempted++;

    const sendResult = await sendWelcomeMessage(row.phone, row.full_name);

    if (!sendResult.success) {
      console.error(
        `[Welcome Dispatch] Send failed for profile ${row.id}:`,
        sendResult.error
      );
      result.failed++;
      continue;
    }

    const { error: stampError } = await supabase
      .from("profiles")
      .update({ welcome_message_sent_at: new Date().toISOString() })
      .eq("id", row.id);

    if (stampError) {
      console.error(
        `[Welcome Dispatch] Stamp failed for profile ${row.id}:`,
        stampError
      );
      result.failed++;
    } else {
      result.sent++;
    }
  }

  console.log("[Welcome Dispatch] Complete:", result);
  return result;
}
