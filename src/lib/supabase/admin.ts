import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

/**
 * Creates a Supabase client with service role privileges.
 * Use this only in server-side code (API routes, webhooks) where
 * you need to bypass RLS policies.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin credentials");
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
