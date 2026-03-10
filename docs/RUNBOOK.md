<!-- AUTO-GENERATED from vercel.json, next.config.ts, and source code — 2026-03-10 -->

# Runbook

## Deployment

### Preview Deploy
```bash
vercel
```

### Production Deploy
```bash
npm run build          # Verify build succeeds locally
vercel --prod          # Deploy to production
```

Production URL: https://www.edengarden.co.il

### Database Migrations
```bash
supabase db push       # Push pending migrations to Supabase
```

Migrations in `supabase/migrations/` — two formats:
- Legacy: `NNN_description.sql` (001-013)
- Current: `YYYYMMDDHHMMSS_description.sql`

## Health Check

```
GET /api/health
```

## Cron Jobs (vercel.json)

| Schedule | Endpoint | Description |
|----------|----------|-------------|
| `*/10 * * * *` | `/api/cron/auto-clockout` | Auto clock-out stale trainer shifts |
| `0 2 * * *` | `/api/cron/arbox-sync` | Nightly Arbox user sync |

All cron endpoints require `CRON_SECRET` header for authentication.

## Security Headers (next.config.ts)

Applied to all routes (`/(.*)`):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy-Report-Only` (report-only mode)

## Common Issues

### Build fails with missing env vars
Startup validation in `src/lib/env.ts` requires: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROW_API_URL`. Ensure all are set in Vercel env or `.env.local`.

### Cookie errors in server components
Wrong Supabase client import. Use `createClient()` from `lib/supabase/server.ts` in server code, `lib/supabase/client.ts` in client code.

### RLS silently blocks admin inserts
Existing INSERT policies require `auth.uid() = owner_id`. Add a separate admin INSERT policy when inserting rows on behalf of other users.

### Supabase update returns no error but changes nothing
`.update().eq()` on nonexistent rows returns no error. Pre-check with `.maybeSingle()` if "not found" reporting is needed.

### Stale data in edit dialogs
`useState(prop)` only evaluates on mount. Use `key={item.id}` to force remount when editing different items.

## Rollback

```bash
# List recent deployments
vercel ls

# Promote a previous deployment to production
vercel promote <deployment-url>
```

## Monitoring

- Vercel Analytics: `@vercel/analytics` (auto-enabled)
- Vercel Speed Insights: `@vercel/speed-insights` (auto-enabled)
- Vercel deployment logs: `vercel logs <deployment-url>`
