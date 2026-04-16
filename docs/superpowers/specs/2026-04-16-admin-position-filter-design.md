# Admin Position Filter

## Goal

Let admins filter trainee-listing tables in the admin area by football position, matching the existing filter-toolbar pattern already used on those pages.

## Scope

Add a position filter to the following admin pages (all of which list trainees and already have a filter toolbar):

- `/admin/users`
- `/admin/assessments`
- `/admin/nutrition`
- `/admin/retention`
- `/admin/submissions`
- `/admin/submissions/shift-reports`

Explicitly out of scope:

- Pages that do not list trainees (videos, leads, shifts).
- Adding a position column to tables that do not already show one.
- Server-side filtering (current filters on these pages are all client-side, in-memo).
- Any change to the `profiles.position` data model or migrations.

## UX

A single-select dropdown added to each page's existing toolbar, visually consistent with the role/status dropdowns already in place.

Options (in order):

1. `כל העמדות` (default, no filter)
2. Eleven specific positions, each rendered with its Hebrew label:

   | Code | Label |
   |------|-------|
   | GK   | שוער |
   | CB   | בלם |
   | RB   | מגן ימין |
   | LB   | מגן שמאל |
   | CDM  | קשר הגנתי |
   | CM   | קשר |
   | CAM  | קשר התקפי |
   | LW   | כנף שמאל |
   | RW   | כנף ימין |
   | ST   | חלוץ |
   | CF   | חלוץ מרכזי |

3. `ללא עמדה` (matches trainees whose `position` is `null`)

URL state is persisted via `nuqs` under the `position` query param:

- `?position=ST` — filter to Strikers
- `?position=none` — filter to trainees with no position set
- absent — all positions

## Architecture

### Shared module: `src/lib/admin/position-filter.ts`

Single source of truth for options and the filter predicate. Example shape:

```ts
import { POSITIONS, POSITION_LABELS_HE, type PlayerPosition } from "@/types/player-stats";

export const POSITION_FILTER_ALL = "all";
export const POSITION_FILTER_NONE = "none";

export const positionFilterOptions = [
  { value: POSITION_FILTER_ALL, label: "כל העמדות" },
  ...POSITIONS.map((p) => ({ value: p, label: POSITION_LABELS_HE[p] })),
  { value: POSITION_FILTER_NONE, label: "ללא עמדה" },
];

export function matchesPositionFilter(
  userPosition: PlayerPosition | string | null | undefined,
  filter: string | null,
): boolean {
  if (!filter || filter === POSITION_FILTER_ALL) return true;
  if (filter === POSITION_FILTER_NONE) return !userPosition;
  return userPosition === filter;
}
```

Every toolbar imports `positionFilterOptions`; every data table imports `matchesPositionFilter`. No duplicated option arrays or predicate logic across pages.

### Integration per page

Two toolbar patterns coexist in the codebase today and both stay:

- **Bespoke nuqs toolbars** (e.g., `UserTableToolbar`): add a `useQueryState("position", parseAsString)` hook, render a `<Select>` block modeled after the existing role/status blocks, add an `onPositionChange` prop, wire it to the data table, and extend the existing `useMemo` filter to call `matchesPositionFilter(user.position, positionFilter)`.
- **Shared `TableToolbar` pages**: drop a `<ToolbarSelect>` into the `filters` slot bound to `positionFilterOptions`, and apply the predicate in the same memoized filter step the page already uses.

No cross-pattern refactor. Each page adopts its own existing pattern.

### Data

`profiles.position` already exists on all trainee profiles (enum of 11 positions, nullable). The six pages in scope either load profile rows directly or join to them; the plan phase verifies each page has `position` in its query shape and extends the select list where it does not.

Filtering runs on the client in the existing `useMemo`, consistent with how role/status filters work today. No server changes, no migration.

## Testing

Project convention is unit tests on pure utilities only. Add Vitest coverage for `matchesPositionFilter`:

- `filter = null` → matches any input, including `null`.
- `filter = "all"` → matches any input, including `null`.
- `filter = "ST"` → matches `"ST"`; rejects `"CF"` and `null`.
- `filter = "none"` → matches `null` and `undefined`; rejects any specific position.

No component or integration tests added; matches repo convention for filter utilities.

## Edge Cases

- **Admin/trainer rows on `/admin/users`**: these profiles never carry a position. Selecting a specific position hides them — expected, since position is a trainee concept. `ללא עמדה` shows them alongside trainees with unfinished onboarding, which is consistent with the data-hygiene use case.
- **Unknown `position` query param value** (e.g., `?position=xyz`): predicate returns no matches; empty state is rendered. Same failure mode as any other invalid filter value, safe.
- **Trainee onboarding later sets a position**: no special handling — next page load reflects the change, same as every other filter.

## Success Criteria

- All six admin pages render a position dropdown in their existing filter toolbar, in Hebrew, with the 13 options listed above.
- Selecting a specific position filters the table to matching trainees and updates the URL to `?position=<code>`.
- Selecting `ללא עמדה` filters to rows with `position` null and sets `?position=none`.
- Selecting `כל העמדות` clears the filter and removes the `position` param from the URL.
- Browser back/forward restores the previous position filter.
- `matchesPositionFilter` unit tests pass.
- `npm run lint` and `npx tsc --noEmit` pass.
