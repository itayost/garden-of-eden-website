# Technology Stack

**Analysis Date:** 2026-02-01

## Languages

**Primary:**
- TypeScript 5.x - Full application including React components, Next.js pages, and backend routes
- JavaScript - Config files (eslint, vitest)

**Secondary:**
- HTML/CSS - Rendered via React and Tailwind CSS

## Runtime

**Environment:**
- Node.js (version specified in package.json, inferred from Next.js 16.1.0 compatibility)

**Package Manager:**
- npm (lock file present at `package-lock.json`)

## Frameworks

**Core:**
- Next.js 16.1.0 - Full-stack React framework for API routes, server-side rendering, and pages
- React 19.2.3 - UI component library and hooks
- React DOM 19.2.3 - React rendering to DOM

**Testing:**
- Vitest 4.0.17 - Unit and integration test runner
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/dom 10.4.1 - DOM testing utilities
- @testing-library/jest-dom 6.9.1 - Jest matchers for testing-library
- jsdom 27.4.0 - DOM implementation for Node.js tests

**UI Framework:**
- Tailwind CSS 4.x - Utility-first CSS framework for styling
- @tailwindcss/postcss 4.x - PostCSS plugin for Tailwind

**Build/Dev:**
- ESLint 9.x - Linting with next-specific rules
- TypeScript compiler - Type checking and transpilation
- @vitejs/plugin-react 5.1.2 - React plugin for Vitest

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.89.0 - Supabase database client for REST operations
- @supabase/ssr 0.8.0 - Supabase Server-Side Rendering support for Next.js authentication

**UI Components:**
- @radix-ui/react-* (10+ packages) - Accessible component primitives
  - Includes: avatar, dialog, dropdown-menu, label, select, separator, slider, switch, tabs, tooltip
- class-variance-authority 0.7.1 - Utility for building component variants
- clsx 2.1.1 - Utility for conditional classname concatenation
- tailwind-merge 3.4.0 - Smart CSS class merging for Tailwind

**Forms & Validation:**
- react-hook-form 7.69.0 - Performant form state management
- @hookform/resolvers 5.2.2 - Schema resolver support for react-hook-form
- zod 4.2.1 - TypeScript-first schema validation

**Data Visualization:**
- recharts 2.15.4 - Chart and graph components for analytics/progress tracking

**UI Utilities:**
- framer-motion 12.23.26 - Animation library for React
- lucide-react 0.562.0 - Icon library
- react-icons 5.5.0 - Additional icon library
- sonner 2.0.7 - Toast notification library
- next-themes 0.4.6 - Dark mode/theme management

**Other:**
- next-env.d.ts - Next.js TypeScript definitions (auto-generated)
- tw-animate-css 1.4.0 - Animation utilities for Tailwind

## Configuration

**Environment:**
- `.env.local` for local development (contains secrets, not committed)
- `.env.local.example` for reference
- Environment variables loaded via Next.js built-in support

**Key Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (secret, server-only)
- `GROW_API_URL` - GROW/Meshulam payment gateway API endpoint
- `GROW_USER_ID` - GROW user credentials
- `GROW_PAGE_CODE` - GROW page code for one-time payments
- `GROW_PAGE_CODE_RECURRING` - GROW page code for recurring payments
- `NEXT_PUBLIC_SITE_URL` - Site URL for auth callbacks
- `VERCEL_URL` - Vercel deployment URL (for preview/production)

**TypeScript Configuration:**
- Target: ES2017
- Module: esnext
- JSX: react-jsx
- Path alias: `@/*` → `./src/*`
- Strict mode enabled
- Source: `tsconfig.json`

**Build Configuration:**
- Next.js: `next.config.ts` (minimal config, no custom webpack overrides)
- Tailwind CSS: `tailwind.config.js` (default with Tailwind CSS 4 PostCSS)
- PostCSS: `postcss.config.mjs`
- ESLint: `eslint.config.mjs` (extends Next.js config with TypeScript support)

**Vitest Configuration:**
- Config: `vitest.config.ts`
- Environment: jsdom
- Setup file: `src/test/setup.ts`
- Test files: `src/**/*.{test,spec}.{ts,tsx}`
- Global test utilities enabled
- Path alias configured to match TypeScript config

## Platform Requirements

**Development:**
- Node.js (compatible with Next.js 16.1.0, suggests 18.17+)
- npm for package management

**Production:**
- Deployment target: Vercel (`.vercel` config present)
- Can be deployed to any Node.js server supporting Next.js
- Requires environment variables for Supabase and GROW credentials
- Requires internet connectivity for external API calls to Supabase and GROW

---

*Stack analysis: 2026-02-01*
