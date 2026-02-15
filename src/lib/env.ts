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
