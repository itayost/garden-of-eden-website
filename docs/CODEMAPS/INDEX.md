<!-- Generated: 2026-06-22 | Complete codemap index -->

# Garden of Eden Website - Architecture Codemaps

**Last Updated:** 2026-06-22
**Files Scanned:** 545 (src .ts/.tsx) · 66 migrations
**Total Token Estimate:** ~4500

Architectural codemaps for the Garden of Eden football academy platform
(Next.js 16 App Router + React 19 + Supabase, Hebrew RTL, roles
trainee/trainer/admin). Each file is token-lean and can be read independently.

## Quick Navigation

### [architecture.md](./architecture.md)
**High-level system overview**
- Single Next.js 16 + Supabase deployment, Vercel hosting
- Data flow (Server Components / Server Actions / API routes -> middleware -> Supabase)
- Auth flow (WhatsApp OTP -> Supabase -> session, optional 2FA)
- Role-based access (/admin, /dashboard, /auth, /) and key directories
- "New since 2026-05-26": leads CRM, churned retention, shift other-purpose, communication log, nutrition measurements

**Start here if:** You're new to the project or need the big picture.

### [backend.md](./backend.md)
**API routes and server actions**
- 20 API routes by purpose (8 cron, images, webhooks, payments, nutrition, shifts, clips, player-report, whatsapp, health)
- 32+ server actions by domain (admin users/assessments, leads + lead-tabs, retention + churned, shifts + change-requests, nutrition, communication log)
- verify helpers (verifyAdmin / verifyAdminOrTrainer / verifyUserAccess), Supabase clients + typedFrom, cron schedules
- External integrations (Arbox, Meshulam/Grow, Remove.bg, Upstash, WhatsApp)

**Start here if:** You're implementing an API endpoint or server action.

### [frontend.md](./frontend.md)
**Pages, components, and features**
- Page tree (landing, auth, onboarding, dashboard/*, admin/* incl. leads/retention/shifts)
- Component hierarchy by area (admin sub-dirs, dashboard, landing, 27 ui primitives)
- 13 feature modules (achievements, rankings, nutrition, clips, next-game, ...)
- Shared hooks + state (RSC + server actions, nuqs URL state, react-hook-form, offline shift queue)

**Start here if:** You're building a UI page or component.

### [data.md](./data.md)
**Database tables, relationships, migrations**
- Tables by domain: profiles/auth, assessments/ratings, nutrition (+measurements, two meal-plan PDFs), shifts (+other_purpose, change-requests, communication), leads (+tabs/source/trainer), retention (reports/notes/churned), communication log, clips, goals
- Key relationships, RLS pattern, Storage buckets
- Migration history (66 migrations, legacy NNN_ + timestamp formats)

**Start here if:** You're changing the schema or writing a migration.

### [dependencies.md](./dependencies.md)
**External services, integrations, shared libs**
- External services (Supabase, Vercel cron/analytics, Upstash Redis, Meshulam/Grow, Arbox, Remove.bg, WhatsApp)
- Key npm dependencies grouped (framework, UI, forms/validation, data, charts, pdf, testing)
- Shared internal libs (src/lib utilities, validations, constants) and required env vars

**Start here if:** You're adding an integration or touching configuration.

## Maintenance

Regenerate after major feature work. The curated set above (architecture,
backend, frontend, data, dependencies) follows the ECC `update-codemaps`
format; keep each file under ~1000 tokens and refresh the
`<!-- Generated: ... -->` header. See `codemap-diff.txt` for the latest
change report.
