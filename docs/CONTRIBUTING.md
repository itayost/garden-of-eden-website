<!-- AUTO-GENERATED from package.json, .env.local.example, and source code — 2026-03-10 -->

# Contributing Guide

## Prerequisites

- Node.js >= 20
- npm
- Supabase CLI (`npx supabase`)
- Vercel CLI (`npx vercel`) for deployments
- Access to Supabase project and Vercel team

## Setup

```bash
git clone <repo-url>
cd garden-of-eden-website
npm install
```

Copy env file and fill in values (or pull from Vercel):

```bash
cp .env.local.example .env.local
# OR pull production env from Vercel:
vercel env pull .env.local --environment=production
```

Start development:

```bash
npm run dev
```

## Available Commands

<!-- AUTO-GENERATED:scripts-start -->
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server with hot reload |
| `npm run build` | Production build with type checking |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint on the codebase |
| `npm run test` | Run Vitest in watch mode |
| `npm run test:run` | Run Vitest single pass |
| `npm run test:coverage` | Run Vitest with coverage report |
| `npx tsc --noEmit` | Type-check without emitting files |
| `supabase db push` | Push migrations to Supabase |
| `vercel` | Preview deployment |
| `vercel --prod` | Production deployment |
<!-- AUTO-GENERATED:scripts-end -->

## Testing

- Framework: Vitest + React Testing Library (jsdom)
- Tests cover pure utility functions (validations, ranking-utils, webhook-security)
- No mock-based tests; project uses real Supabase data
- Run `npm run test:run` before committing

## Code Style

- TypeScript strict mode
- ESLint enforced via `lint-staged` on pre-commit (Husky)
- All UI text in Hebrew; RTL layout (`dir="rtl"`)
- Use `@/` path alias for imports from `src/`
- Prefer immutable patterns (no object/array mutation)
- Files: 200-400 lines typical, 800 max

## Pre-Commit Hooks

Husky + lint-staged auto-runs on commit:

```
*.{ts,tsx} -> eslint --fix
```

Claude Code hooks additionally run:
- ESLint auto-fix after file edits
- `tsc --noEmit` type-check after `.ts/.tsx` edits
- Block edits to `.env*` files

## Commit Format

```
<type>(scope): description
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

Scopes: `auth`, `admin`, `mobile`, `nutrition`, `shifts`, `arbox`, etc.

## PR Checklist

- [ ] `npm run build` passes
- [ ] `npm run test:run` passes
- [ ] `npx tsc --noEmit` passes
- [ ] No hardcoded secrets
- [ ] RTL layout tested for UI changes
- [ ] All user-facing text in Hebrew
