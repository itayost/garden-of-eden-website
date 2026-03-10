<!-- Generated: 2026-03-10 | Files scanned: 404 | Token estimate: ~600 -->

# Dependencies

## External Services

```
Supabase         Postgres DB, Auth (WhatsApp OTP), Storage, RLS
Vercel           Hosting, serverless functions, cron jobs, analytics
Upstash Redis    Rate limiting on sensitive endpoints
Meshulam/Grow    Payment gateway (create page, webhook verification)
Remove.bg        Image background removal for FIFA player cards
Arbox            Gym management sync (nightly cron)
WhatsApp Business  Flow endpoint for user interactions
```

## Key Runtime Dependencies

```
next 16.1.6              App framework (App Router, Server Components)
react 19.2.3             UI library
@supabase/supabase-js    DB client
@supabase/ssr            Server-side Supabase (cookies)
tailwindcss 4            Styling
@radix-ui/*              UI primitives (13 packages)
framer-motion            Animations
react-hook-form + zod    Form validation
recharts                 Charts (progress visualization)
@tanstack/react-table    Data tables
sonner                   Toast notifications
nuqs                     URL search params state
papaparse                CSV parsing (import/export)
lucide-react             Icons
driver.js                Onboarding tour
@react-pdf/renderer      PDF generation
next-themes              Dark/light theme
@upstash/ratelimit       Rate limiting
@upstash/redis           Redis client
@vercel/analytics        Vercel analytics
@vercel/speed-insights   Performance monitoring
@huggingface/transformers  Client-side background removal
class-variance-authority   Component variant styling
```

## Dev Dependencies

```
typescript 5         Type system
vitest 4             Test runner
@testing-library/*   Component testing (jsdom)
eslint 9             Linting
eslint-config-next   Next.js ESLint rules
husky                Git hooks
lint-staged          Pre-commit linting
@tailwindcss/postcss PostCSS integration
tw-animate-css       Animation utilities
```

## Shared Libraries (internal)

```
src/lib/utils.ts                  cn() class merge utility
src/lib/utils/math.ts             calculatePercentile()
src/lib/utils/calculate-user-ratings.ts  Dashboard rating computation
src/lib/utils/israel-time.ts      Israel timezone helpers
src/lib/utils/storage.ts          Storage path utilities
src/lib/utils/date.ts             Date formatting
src/lib/assessment-to-rating.ts   Assessment score to rating conversion
src/lib/exports/                  CSV export utilities
```
