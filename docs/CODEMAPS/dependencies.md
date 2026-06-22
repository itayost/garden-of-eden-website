<!-- Generated: 2026-06-22 | Files scanned: 545 | Token estimate: ~760 -->

# Dependencies

## External Services

```
Supabase            Postgres DB, Auth (WhatsApp OTP), Storage, RLS
Vercel              Hosting, serverless functions, cron jobs, analytics
Upstash Redis       Rate limiting on sensitive endpoints (player PDF, auth)
Meshulam/Grow       Payment gateway (create page, webhook verification, recurring)
Remove.bg           Image background removal for FIFA player cards
Arbox               Gym management sync (nightly cron) + retention reports + full_name fix
WhatsApp Business   Flow endpoint for user interactions + welcome template
```

## Key Runtime Dependencies

```
next 16.1.6              App framework (App Router, Server Components)
react 19.2.3             UI library
@supabase/supabase-js    DB client
@supabase/ssr            Server-side Supabase (cookies)
tailwindcss 4            Styling
@radix-ui/*              UI primitives (13+ packages: dialog, tabs, select, switch, tooltip…)
framer-motion            Animations
react-hook-form + zod    Form validation (zod v4)
recharts                 Charts (progress visualization, retention dashboards)
@tanstack/react-table    Data tables (assessments, leads, users)
sonner                   Toast notifications
nuqs                     URL search params state
papaparse                CSV parsing/export (leads, retention, users)
lucide-react             Icons
driver.js                Onboarding tour
@react-pdf/renderer      PDF generation (meal plans, player reports, assessment PDFs)
next-themes              Dark/light theme
@upstash/ratelimit       Rate limiting
@upstash/redis           Redis client
@vercel/analytics        Vercel analytics
@vercel/speed-insights   Performance monitoring
@vercel/functions        Vercel serverless function helpers
@huggingface/transformers  Client-side background removal
html-to-image            DOM-to-image capture (player cards)
browser-image-compression  Client-side image compression before upload
puppeteer-core + @sparticuz/chromium  Headless PDF rendering on serverless
use-debounce             Debounced search inputs
class-variance-authority   Component variant styling
clsx / tailwind-merge    Class name utilities
react-icons              Supplemental icon set
```

## Dev Dependencies

```
typescript 5         Type system (strict)
vitest 4             Test runner
@testing-library/*   Component testing (jsdom)
@playwright/test     E2E testing
@axe-core/playwright Accessibility checks in E2E
eslint 9             Linting
eslint-config-next   Next.js ESLint rules
husky                Git hooks
lint-staged          Pre-commit linting
@tailwindcss/postcss PostCSS integration
tw-animate-css       Animation utilities
```

## Shared Internal Libraries (src/lib/)

```
utils.ts                              cn() class merge utility
utils/math.ts                         calculatePercentile()
utils/calculate-user-ratings.ts       Dashboard rating computation (get-player-ratings.ts)
utils/israel-time.ts                  Israel timezone helpers
utils/date.ts                         Date formatting
utils/uuid.ts                         UUID validation helpers
utils/parse-leads-paste.ts            Paste-from-Sheets bulk leads parser (NEW)
utils/parse-churned-paste.ts          Churned-customers paste parser
utils/shift-other-purpose.ts          Shift other-purpose split helpers (NEW)
utils/retention-month-list.ts         Retention month list builder
utils/churned-key.ts                  Churned customer key generation
assessment-to-rating.ts               Assessment score -> rating conversion
rate-limit.ts                         Upstash rate limiter wrapper
webhook-security.ts                   Grow webhook HMAC verification
arbox/client.ts                       Arbox API client
arbox/sync.ts                         Nightly trainee sync logic
arbox/retention.ts                    Retention report aggregation + Arbox merge
arbox/persist-retention-report.ts     Snapshot persistence helpers
arbox/reports.ts                      Retention report queries
arbox/normalize-phone.ts              Phone normalization
exports/player-report-html.ts         HTML->PDF pipeline for player stats
exports/pdf-player-report-template.tsx  React-PDF player report template
exports/pdf-assessment-template.tsx   React-PDF assessment template
validations/common.ts                 isValidUUID(), shared Zod schemas
validations/leads.ts                  Lead Zod schemas (phoneless, club, birth_year…)
validations/lead-tabs.ts              Lead tabs Zod schemas (NEW)
validations/shift-change-requests.ts  Shift change request schemas (NEW)
validations/communication-log.ts      Trainee communication log schemas (NEW)
validations/nutrition-measurements.ts Nutrition measurement schemas (NEW)
validations/shift-report.ts           Shift report (homework/video/praise) schemas
constants/shifts.ts                   Shift category constants
constants/hebrew-months.ts            Hebrew month name map
```

## Environment Variables

```
# Required
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GROW_API_URL

# Optional (warn in dev if missing)
UPSTASH_REDIS_REST_URL / _TOKEN
CRON_SECRET
GROW_USER_ID / GROW_PAGE_CODE / GROW_PAGE_CODE_RECURRING
GROW_WEBHOOK_SECRET / GROW_PROCESS_TOKEN
REMOVEBG_API_KEY
WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_FLOW_ID
WHATSAPP_FLOW_PRIVATE_KEY / WHATSAPP_WEBHOOK_VERIFY_TOKEN
WHATSAPP_WELCOME_TEMPLATE_NAME
LEADS_WEBHOOK_API_KEY
ARBOX_API_KEY
```
