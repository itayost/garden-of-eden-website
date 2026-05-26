# Leads — User-Managed Tabs

**Date**: 2026-05-26
**Status**: Design

## Context

The leads page currently exposes two hardcoded tabs — "ממומנים" (paid) and "אורגניים" (organic) — driven by a `leads.source TEXT NOT NULL CHECK (source IN ('paid', 'organic'))` column. Admins want to organise leads into more buckets than that: campaigns, referral sources, lead lists, follow-up cohorts. The two-bucket cap forces overloading the existing tabs and crowds the `note`/`additional_info` fields with category data that should be first-class.

We want to replace the fixed enum with a small CRUD system on top of a `lead_tabs` table so admins can create, rename, reorder, recolor, set default, and delete tabs from the leads page itself. Each lead belongs to one tab. The two existing tabs become regular rows in `lead_tabs` so nothing breaks visually on day one.

This is one cohesive feature, sized for a single implementation plan. No decomposition needed.

## Decisions

1. **Replace `source` with FK to `lead_tabs`**. Cleaner than adding a parallel column; the existing two values seed as regular rows. We keep the `source` column for one migration cycle for safety, then drop it in a follow-up migration once the new pipeline is verified.

2. **Per-tab fields**: `name` (Hebrew display), `slug` (stable URL-safe id), `color` (badge hue, optional), `position` (sort order), `is_default` (where new leads land), soft-delete via `deleted_at`. No `is_system` flag — every tab is user-editable.

3. **Exactly one default tab** enforced at the DB level with a partial unique index. Setting a new default in app code clears the previous one in the same transaction.

4. **Tab deletion forces lead reassignment**. Admin picks a destination tab; the action moves the leads and soft-deletes the tab in one server action / SQL transaction. Last tab cannot be deleted (the API blocks it).

5. **URL switches from `?source=` to `?tab=<slug>`**. The page also resolves the legacy `?source=paid|organic` values via the seeded slugs so existing bookmarks and links from CSV exports keep working.

6. **Webhook backwards compatibility**: `/api/webhooks/leads` keeps accepting `source: "paid" | "organic"` (translated to the matching tab) and adds `tab_slug` as the canonical field. Missing both resolves to the default tab.

7. **Reordering for v1 uses up/down arrow buttons**, not drag-and-drop. Smaller surface area; we can upgrade later if needed.

## Data model

```sql
CREATE TABLE lead_tabs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  color       TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  CONSTRAINT lead_tabs_slug_format CHECK (slug ~ '^[a-z0-9_-]{1,50}$')
);

CREATE UNIQUE INDEX lead_tabs_one_default
  ON lead_tabs (is_default) WHERE is_default = true AND deleted_at IS NULL;

CREATE INDEX lead_tabs_position_idx
  ON lead_tabs (position) WHERE deleted_at IS NULL;

ALTER TABLE leads
  ADD COLUMN tab_id UUID REFERENCES lead_tabs(id) ON DELETE RESTRICT;

CREATE INDEX leads_tab_id_idx ON leads (tab_id);
```

**Migration steps** (single migration file):
1. Create `lead_tabs` table + indexes.
2. Seed two rows mirroring today's tabs:
   - `{ slug: 'paid',    name: 'ממומנים',  position: 0, is_default: true  }`
   - `{ slug: 'organic', name: 'אורגניים', position: 1, is_default: false }`
3. Add `leads.tab_id` (nullable initially).
4. Backfill `leads.tab_id` from `leads.source`.
5. Set `leads.tab_id` NOT NULL.
6. Drop the `source` CHECK constraint (leave the column for one cycle, no longer authoritative).
7. RLS: same as `leads` — admin or trainer can SELECT; only admin can INSERT/UPDATE/DELETE (`lead_tabs` is admin-only writeable; trainers see tabs but can't manage them).

The `source` column is dropped in a separate follow-up migration after a release of the new code.

## Server actions

New file `src/lib/actions/admin-lead-tabs.ts` (split into focused files if it grows past 200 lines):

| Action | Signature | Notes |
|--------|-----------|-------|
| `listLeadTabsAction` | `() => ActionResult<LeadTab[]>` | Active tabs ordered by `position`. Used by every consumer. Wrapped in `cache()`. |
| `createLeadTabAction` | `(input: LeadTabCreateInput) => ActionResult<LeadTab>` | Admin-only. Auto-derives `slug` from `name` if not supplied; appends `-N` on collision. |
| `updateLeadTabAction` | `(input: LeadTabUpdateInput) => ActionResult<LeadTab>` | Admin-only. Setting `is_default: true` clears the previous default in a single transaction. |
| `reorderLeadTabsAction` | `(orderedIds: string[]) => ActionResult<void>` | Admin-only. Bulk update positions. |
| `deleteLeadTabAction` | `(tabId: string, moveLeadsToTabId: string) => ActionResult<void>` | Admin-only. Transaction: `UPDATE leads SET tab_id=$2 WHERE tab_id=$1; UPDATE lead_tabs SET deleted_at=now() WHERE id=$1`. Blocks if it's the only tab or if `moveLeadsToTabId` equals `tabId`. |
| `assignLeadToTabAction` | `(leadId: string, tabId: string) => ActionResult<void>` | Admin-or-trainer. For inline reassignment from the detail sheet. |

`getLeadsAction` and `getLeadsStatsAction` switch from filtering by `source` to filtering by `tab_id`. The page resolves a `?tab=<slug>` param to a `tab_id` and passes that down.

`createLeadAction` accepts an optional `tab_id`; missing → default tab.

## Validation

New `src/lib/validations/lead-tabs.ts`:

- `slug`: `z.string().regex(/^[a-z0-9_-]{1,50}$/)`, optional on create (auto-derived).
- `name`: 1–80 chars, trimmed.
- `color`: optional, validated against a small allow-list (`gray|blue|green|orange|purple|red|pink|yellow`). Maps to Tailwind classes client-side.
- `is_default`: boolean.
- `position`: integer ≥ 0.

The `leadCreateSchema`, `leadUpdateSchema`, and `leadWebhookSchema` lose `source` validation and gain optional `tab_id` (UUID). The webhook also accepts a legacy `source` field that the route resolves to a `tab_id` before insert.

## Types

`src/types/lead-tabs.ts`:

```ts
export interface LeadTab {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
```

`src/types/leads.ts` changes:
- Remove `LEAD_SOURCES`, `LeadSource`, `LEAD_SOURCE_LABELS`.
- `Lead` gains `tab_id: string`; the joined shape `tab?: LeadTab | null` populates from a relations join.
- `LEAD_SELECT_WITH_TRAINER` becomes `LEAD_SELECT_WITH_RELATIONS`: `*, assigned_trainer:profiles!leads_assigned_trainer_id_fkey(id, full_name), tab:lead_tabs!leads_tab_id_fkey(*)`.

## UI components

**Modified:**
- `src/components/admin/leads/LeadsTabs.tsx` — receives `tabs: LeadTab[]` and `activeSlug: string`, renders `<Link>` per tab with `?tab=<slug>`. Adds a small "ניהול טאבים" pencil button at the end that opens the manager. The button is rendered only for admins.
- `src/components/admin/leads/LeadDetailSheet.tsx` — replaces source Select with a tab Select. Inline saves call `assignLeadToTabAction`; full form submit still uses `updateLeadAction`.
- `src/components/admin/leads/LeadCreateDialog.tsx` — replaces source Select with a tab Select pre-filled with the active tab.
- `src/components/admin/leads/LeadDataTable.tsx` — accepts `tabs` and `activeTab`; threads them down.
- `src/components/admin/leads/LeadTableColumns.tsx` — `showPaidIndicator` keyed on `activeTab.slug === 'paid'`; column shape unchanged. The "מקור" idea retires — the tab column shows the joined tab name as a `LeadTabBadge`.
- `src/components/admin/exports/LeadExportButton.tsx` — exports `tab.name` instead of `LEAD_SOURCE_LABELS[lead.source]`.
- `src/app/admin/leads/page.tsx` — fetches tabs, resolves active tab from `?tab=<slug>` (with `?source=` alias), passes everything down. Filters server-side by `tab_id`.

**New:**
- `src/components/admin/leads/LeadTabsManager.tsx` — Dialog listing all tabs with rename, color picker, set-default, reorder (up/down arrows), and delete-with-move. Server actions wired via `useTransition`.
- `src/components/admin/leads/LeadTabFormDialog.tsx` — Add/edit modal: name, color, default toggle.
- `src/components/admin/leads/LeadTabDeleteDialog.tsx` — Confirmation + destination tab picker.
- `src/components/admin/leads/LeadTabBadge.tsx` — Small colored pill used in the table column and detail sheet.

## URL and routing

- Primary param: `?tab=<slug>`.
- Legacy `?source=paid|organic` is resolved by the page to the matching slug (case-insensitive) and silently rewritten internally — no redirect, the page just uses the resolved slug. The CSV export and internal `<Link>`s emit the new `?tab=` form.
- If `?tab=<unknown>` is passed, the page falls back to the default tab.

## Webhook compatibility

`/api/webhooks/leads` (Zod schema):
- New field `tab_slug?: string`.
- Legacy `source?: "paid" | "organic"` still accepted.
- Resolution order at the route level: `tab_slug` → look up tab; else `source` → look up tab; else default tab.
- If a supplied `tab_slug` does not match an existing tab, return `400` with a Hebrew error message.

## RLS

`lead_tabs`:
- SELECT: admin or trainer (matches `leads`).
- INSERT/UPDATE/DELETE: admin only.
- Soft delete only — actions set `deleted_at`, never `DELETE` rows.

`leads`:
- Unchanged. RLS already covers admin + trainer for all CRUD.

## Permissions in the UI

- Trainers see the tabs and can switch between them, view leads, and (per existing RLS) edit lead fields including reassigning a lead to a different tab.
- The "ניהול טאבים" button is rendered only when the viewer is an admin. Trainers see the tabs but not the manage button.

## Acceptance criteria

- Admin opens `/admin/leads`, clicks "ניהול טאבים", creates a third tab "מועדון לוקאלי" with color green. The new tab appears immediately to the right of the existing two and is selectable.
- Admin renames "ממומנים" to "קמפיינים ממומנים" and saves; existing leads stay in place; the tab label updates everywhere.
- Admin marks a tab as default; new webhook leads with no `tab_slug`/`source` end up there.
- Admin deletes a tab with leads; UI prompts for a destination tab; on confirm, leads move and the tab is soft-deleted; URL falls back gracefully if the active tab was the deleted one.
- Setting two tabs both to default is prevented (DB partial unique index + app-level check).
- Existing `?source=paid` bookmarks still resolve to the seeded "ממומנים" tab.
- `POST /api/webhooks/leads` with `tab_slug: 'paid'` produces the same row as before.
- CSV export contains a "טאב" column with the tab's Hebrew name (replacing the "מקור" column).
- TypeScript and ESLint both pass.

## Out of scope

- Multi-tab assignment per lead (a lead belongs to exactly one tab).
- Drag-and-drop reorder (up/down arrows only for v1).
- Per-user tab visibility / sharing rules (every admin sees every tab).
- Bulk reassignment from the table (one-by-one via the detail sheet for v1).
- Filters or analytics scoped to tabs beyond what the existing stats panel produces per tab.

## Files touched

**New**
- `supabase/migrations/<timestamp>_lead_tabs.sql`
- `src/types/lead-tabs.ts`
- `src/lib/validations/lead-tabs.ts`
- `src/lib/actions/admin-lead-tabs.ts`
- `src/components/admin/leads/LeadTabsManager.tsx`
- `src/components/admin/leads/LeadTabFormDialog.tsx`
- `src/components/admin/leads/LeadTabDeleteDialog.tsx`
- `src/components/admin/leads/LeadTabBadge.tsx`

**Modified**
- `src/types/leads.ts`
- `src/lib/validations/leads.ts`
- `src/lib/actions/admin-leads-list.ts`
- `src/lib/actions/admin-leads-create.ts`
- `src/lib/actions/admin-leads-update.ts`
- `src/components/admin/leads/LeadsTabs.tsx`
- `src/components/admin/leads/LeadDataTable.tsx`
- `src/components/admin/leads/LeadTableColumns.tsx`
- `src/components/admin/leads/LeadDetailSheet.tsx`
- `src/components/admin/leads/LeadCreateDialog.tsx`
- `src/components/admin/exports/LeadExportButton.tsx`
- `src/app/admin/leads/page.tsx`
- `src/app/api/webhooks/leads/route.ts`

## Verification

1. Migration applied via Supabase MCP; DB reflects: `lead_tabs` exists with two seeded rows; every lead has `tab_id` populated.
2. `npx tsc --noEmit` and `npm run lint` exit 0.
3. Manually: visit `/admin/leads`, switch tabs, create/rename/delete a tab, reassign a lead.
4. Send a test POST to `/api/webhooks/leads` with `tab_slug: 'paid'` and another with `source: 'organic'`; both land in the right tab.
5. Confirm CSV export contains the tab name column.
