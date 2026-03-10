<!-- AUTO-GENERATED from .env.local.example and src/lib/env.ts — 2026-03-10 -->

# Environment Variables

Source of truth: `.env.local.example` + `src/lib/env.ts`

Validated at startup via `src/lib/env.ts` (called from `src/instrumentation.ts`).

## Required Variables

Startup fails if any of these are missing.

<!-- AUTO-GENERATED:env-required-start -->
| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) | `eyJ...` |
| `GROW_API_URL` | Meshulam payment API endpoint | `https://sandbox.meshulam.co.il/api/light/server/1.0` |
<!-- AUTO-GENERATED:env-required-end -->

## Optional Variables

Warnings logged in development if missing. Features degrade gracefully.

<!-- AUTO-GENERATED:env-optional-start -->
| Variable | Description | Feature |
|----------|-------------|---------|
| `NEXT_PUBLIC_SITE_URL` | Site URL for auth callbacks | Auth redirects |
| `GROW_USER_ID` | Meshulam user ID | Payments |
| `GROW_PAGE_CODE` | Meshulam page code | Payments |
| `GROW_PAGE_CODE_RECURRING` | Meshulam recurring page code | Recurring payments |
| `GROW_WEBHOOK_SECRET` | HMAC-SHA256 webhook signature secret | Webhook verification |
| `GROW_PROCESS_TOKEN` | Fallback token for webhook verification | Webhook verification |
| `REMOVEBG_API_KEY` | Remove.bg API key | FIFA card image processing |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token | Rate limiting |
| `CRON_SECRET` | Secret for `/api/cron/*` endpoints | Cron job auth |
| `ARBOX_API_KEY` | Arbox gym management API key | Nightly user sync |
| `WHATSAPP_TOKEN` | WhatsApp Business API token | WhatsApp flows |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID | WhatsApp flows |
| `WHATSAPP_FLOW_ID` | WhatsApp flow ID | WhatsApp flows |
| `WHATSAPP_FLOW_PRIVATE_KEY` | WhatsApp flow encryption key | WhatsApp flows |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | WhatsApp webhook verify token | WhatsApp webhooks |
| `LEADS_WEBHOOK_API_KEY` | API key for leads webhook | Lead capture |
<!-- AUTO-GENERATED:env-optional-end -->

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to the client (no `NEXT_PUBLIC_` prefix)
- Production env vars are in Vercel; pull with: `vercel env pull .env.local --environment=production`
- Vercel env pull wraps values in double quotes and appends literal `\n` — strip both when parsing manually
- `.env.local.example` is missing WhatsApp vars and `LEADS_WEBHOOK_API_KEY` — see `src/lib/env.ts` for the full list
