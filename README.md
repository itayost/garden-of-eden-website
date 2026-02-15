# Garden of Eden - Football Academy Website

**Garden of Eden** is a Hebrew (RTL) football academy platform for managing trainees, trainers, and administrative operations.

Production: [https://www.edengarden.co.il](https://www.edengarden.co.il)

## Overview

A full-stack web application serving a football academy with three user roles:

- **Trainee** -- Dashboard with assessments, progress tracking, nutrition plans, goals, and achievements
- **Trainer** -- Shift management, trainee submissions review, and workout forms
- **Admin** -- Full management of users, assessments, nutrition, videos, shifts, and reports

Authentication is handled via WhatsApp OTP through Supabase Auth.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS 4, Radix UI primitives, Framer Motion |
| Database | Supabase (Postgres + Auth + Row Level Security) |
| Hosting | Vercel |
| Caching | Upstash Redis (rate limiting) |
| Payments | Meshulam payment gateway |
| Testing | Vitest + React Testing Library |
| Forms | React Hook Form + Zod validation |

## Prerequisites

- Node.js >= 20
- npm
- [Supabase](https://supabase.com/) account and project
- [Vercel](https://vercel.com/) account (for deployment)
- [Upstash Redis](https://upstash.com/) instance (for rate limiting)

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/<your-org>/garden-of-eden-website.git
   cd garden-of-eden-website
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example file and fill in your values:

   ```bash
   cp .env.local.example .env.local
   ```

   See the [Environment Variables](#environment-variables) section below for the full list.

4. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run Vitest in watch mode
npm run test:run     # Run Vitest (single run)
npx tsc --noEmit     # Type-check without emitting files
```

### Deployment

```bash
vercel               # Preview deployment
vercel --prod        # Production deployment
```

### Database

```bash
supabase db push     # Push migrations to Supabase
```

## Project Structure

```
src/
├── app/                # Next.js App Router pages and API routes
│   ├── admin/          # Admin dashboard
│   ├── dashboard/      # Trainee dashboard
│   ├── auth/           # Authentication flow (OTP login)
│   ├── onboarding/     # New user onboarding
│   └── api/            # API routes (cron, health, images, payments, webhooks)
├── components/
│   ├── ui/             # Shared UI primitives (shadcn/ui based)
│   ├── admin/          # Admin-specific components
│   ├── dashboard/      # Dashboard components
│   ├── landing/        # Landing page sections
│   └── forms/          # Pre/post workout forms
├── features/           # Self-contained feature modules
│   ├── achievements/
│   ├── goals/
│   ├── nutrition/
│   ├── progress-charts/
│   ├── rankings/
│   └── streak-tracking/
├── hooks/              # Shared React hooks
├── lib/
│   ├── actions/        # Server Actions
│   ├── supabase/       # Supabase client helpers
│   ├── validations/    # Zod schemas
│   └── utils/          # Utility functions
├── middleware.ts        # Session refresh and route protection
└── types/              # TypeScript type definitions
```

## Environment Variables

Create a `.env.local` file based on `.env.local.example`. The following variables are required:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `NEXT_PUBLIC_SITE_URL` | Site URL for auth callbacks |
| `GROW_USER_ID` | Meshulam payment gateway user ID |
| `GROW_PAGE_CODE` | Meshulam page code |
| `GROW_API_URL` | Meshulam API endpoint |
| `GROW_WEBHOOK_SECRET` | HMAC-SHA256 webhook signature secret |
| `GROW_PROCESS_TOKEN` | Fallback webhook verification token |
| `REMOVEBG_API_KEY` | Remove.bg API key (FIFA card processing) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL (rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `CRON_SECRET` | Secret for protecting `/api/cron/*` endpoints |

## Deployment

The application is deployed on [Vercel](https://vercel.com/).

1. Link your repository to a Vercel project.
2. Configure all environment variables in the Vercel dashboard under **Settings > Environment Variables**.
3. Deploy:

   ```bash
   vercel --prod
   ```

Vercel automatically deploys preview builds on pull requests and production builds on merges to the `main` branch.

## License

Private -- all rights reserved.
