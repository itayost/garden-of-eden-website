/**
 * Environment variable validation
 *
 * Validates that all required environment variables are set.
 * Called at build time and on server startup.
 */

const requiredServerVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GROW_API_URL",
] as const;

const optionalServerVars = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CRON_SECRET",
  "GROW_USER_ID",
  "GROW_PAGE_CODE",
  "GROW_PAGE_CODE_RECURRING",
  "GROW_WEBHOOK_SECRET",
  "GROW_PROCESS_TOKEN",
  "REMOVEBG_API_KEY",
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_FLOW_ID",
  "WHATSAPP_FLOW_PRIVATE_KEY",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  "WHATSAPP_WELCOME_TEMPLATE_NAME",
  "LEADS_WEBHOOK_API_KEY",
  "ARBOX_API_KEY",
  // Required by the renewal and agreement links; planTokenSecret() throws
  // at the point of use, so a missing value cannot fail open.
  "PLAN_RENEWAL_TOKEN_SECRET",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "MORNING_CLIENT_ID",
  "MORNING_CLIENT_SECRET",
  "MORNING_WEBHOOK_SECRET",
  "MORNING_ENV",
  "MORNING_DOCUMENT_TYPE",
  "ISRACARD_API_URL",
  "ISRACARD_TERMINAL_ID",
  "ISRACARD_API_KEY",
  "WHATSAPP_PLAN_CONFIRMED_TEMPLATE_NAME",
  "WHATSAPP_PLAN_REMINDER_TEMPLATE_NAME",
  "WHATSAPP_BOOKING_REMINDER_TEMPLATE_NAME",
] as const;

/**
 * Validate that all required environment variables are set.
 * Throws an error listing all missing vars if any are missing.
 */
export function validateEnv(): void {
  const missing = requiredServerVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join("\n")}\n\nSee .env.local.example for reference.`
    );
  }

  // The payment limiter fails closed without Redis, which would refuse every
  // card charge in production. Either naming convention counts.
  const hasRedis =
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (process.env.VERCEL_ENV === "production" && !hasRedis) {
    throw new Error(
      "No Redis configured: set UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN (Upstash integration).",
    );
  }

  // Warn about missing optional vars in development
  if (process.env.NODE_ENV === "development") {
    const missingOptional = optionalServerVars.filter(
      (key) => !process.env[key]
    );
    if (missingOptional.length > 0) {
      console.warn(
        `[env] Missing optional environment variables:\n${missingOptional.map((v) => `  - ${v}`).join("\n")}`
      );
    }
  }
}
