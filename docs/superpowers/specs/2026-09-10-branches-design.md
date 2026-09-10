# Branches (סניפים): two physical locations

Date: 2026-09-10
Status: approved design, awaiting implementation plan

## Problem

The academy now operates in two places: חיפה (the existing one) and קריית אתא
(new). Today the platform has no notion of a branch. A trainer sees every
trainee academy-wide, schedule bands and slots carry a free-text location such
as "סטודיו" or "ביתר חיפה", shifts carry no location, and rankings compare every
trainee against every other trainee.

Eden (admin) must be able to say which branch each trainer and trainee belongs
to. A user can belong to one branch or both.

## Decisions already made with the owner

| Question | Decision |
|---|---|
| What a branch changes | All of: admin filter and label, trainer scoping, schedule and shifts per branch, rankings per branch |
| Dual-branch users | Appear in both branches. No primary branch field |
| Branch list | Admin-editable table with its own admin page |
| Arbox as source | Arbox fills a trainee's branch only when Eden has not set it manually. Dormant today: all 465 Arbox clients share one location name, "גארדן אוף עדן" |
| Storage and enforcement | `branches` table plus `profile_branches` join table. Scoping applied in server queries, not RLS |
| Unassigned trainer | Fails open and sees everything, matching the access-tier convention |

## Section 1: Data model and migration

One Supabase migration, timestamp format, unique version.

### New tables

`branches`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `name_he` | text not null unique | Display name |
| `arbox_location_name` | text null unique | Dormant Arbox hook. Null until Eden splits Arbox |
| `is_active` | boolean not null default true | Inactive branches are hidden from pickers but keep history |
| `order_index` | integer not null default 0 | Picker order |
| `created_at`, `updated_at` | timestamptz | Standard |

Seeded with חיפה (order 0) and קריית אתא (order 1).

`profile_branches`

| Column | Type | Notes |
|---|---|---|
| `profile_id` | uuid references profiles(id) on delete cascade | |
| `branch_id` | uuid references branches(id) on delete cascade | |
| `created_at` | timestamptz | |

Primary key `(profile_id, branch_id)`. Index on `branch_id`.

### Columns added to existing tables

- `profiles.branches_set_by_admin_at timestamptz null`. Stamped whenever an
  admin or trainer sets a user's branches. The Arbox sync fills branches only
  when this is null. Added to `enforce_profile_column_guard()` so a user cannot
  set it on their own row.
- `branch_id uuid null references branches(id)` on `weekly_schedule_bands`,
  `weekly_schedule_exceptions`, `daily_schedule_slots`, `trainer_shifts`.
  Nullable so legacy rows and offline clock-ins replayed later never fail.
  Index on each.

The free-text `location_he` on bands, exceptions, and slots stays. It means the
field or room ("סטודיו", "מגרש"), not the branch.

### Backfill

- Every existing profile gets a `profile_branches` row for חיפה.
- Every existing band, exception, slot, and shift gets `branch_id` = חיפה.
- `branches_set_by_admin_at` stays null for everyone, so Arbox may later fill
  branches for anyone Eden has not touched.

New users created after the migration start with no branch.

### RLS

- `branches`: SELECT for all authenticated users. INSERT, UPDATE, DELETE for
  admins via `get_user_role()`.
- `profile_branches`: SELECT where `profile_id = auth.uid()` or caller is
  admin. INSERT, UPDATE, DELETE for admins only. Trainer writes on trainees go
  through the service role inside the server action after `verifyAdminOrTrainer`
  and the trainer-edits-trainee rule.
- Trainer reads of other users' branches go through the service role in server
  actions, the same way `schedule-options.ts` already reads trainees.

### ADR

`docs/adr/0006-branches-are-a-table.md` records that branches are a real table
and supersedes the inline note in the weekly-schedule migration that chose free
text over a locations table.

## Section 2: Admin UI

### Branches page

`/admin/branches`, admin only. Copies the muscles CMS pattern
(`src/features/development-book/components/admin/MusclesClient.tsx` and its
actions): list, create, rename, reorder, activate or deactivate, and set the
Arbox location name. Deleting is not offered. Deactivate is the soft path.

Lives in `src/features/branches/` with `lib/actions/`, `components/admin/`, and
a Zod schema in `src/lib/validations/branch.ts`. Added to `admin-nav.ts` under
the admin-only group.

### User forms

- `UserCreateForm` and `UserEditForm` get a "סניפים" checkbox group listing
  active branches. Zero, one, or both may be checked.
- `userCreateSchema` and `userEditSchema` gain `branch_ids: z.array(uuid)`.
- `getFieldChanges` records branch changes so the activity log shows them.
- Trainers may set branches on trainees only. Trainers cannot change a
  trainer's or admin's branches. This matches the existing role and status
  restriction in `admin-users-update.ts`.
- Any branch write from these forms stamps `branches_set_by_admin_at`.

### Users table

- New "סניף" column rendering one badge per branch, or a muted "ללא סניף".
- New branch filter in `UserTableToolbar`: all, each branch, and "ללא סניף".
  Persisted in the URL through `nuqs` like the other filters.
- The users CSV export gets a "סניף" column, names joined with ", ".
- Bulk action on selected rows: "שיוך לסניף". Adds the chosen branch to each
  selected user without removing other branches. Stamps
  `branches_set_by_admin_at`.

### Arbox sync

In `processArboxUser`, after the profile is matched or created: if the profile's
`branches_set_by_admin_at` is null and `arboxUser.location_name` equals an
active branch's `arbox_location_name`, replace the profile's branches with that
one branch. Nothing else in the sync changes. When no branch matches, the sync
leaves branches untouched. This is the state today.

## Section 3: Trainer scoping

`src/lib/branches/branch-scope.ts` exports `resolveBranchScope(profile,
branchIds)` returning `{ kind: "all" } | { kind: "branches", ids: string[] }`.
Admins resolve to all. Trainers with at least one branch resolve to their ids.
Trainers with no branch resolve to all.

`getBranchScopeAction()` in `src/lib/actions/shared/` loads the caller's
branches with the user client and returns the resolved scope. It is called
next to `verifyAdminOrTrainer` wherever a list is read.

A trainee is in scope when they share at least one branch with the trainer.

Applied to:

- Users list page and `UserDataTable`
- Assessments list, month view, and the per-user assessment pages
- Submissions page, all five tabs, by the submitting user's branches
- Retention table
- Tasks
- Schedule pick lists in `schedule-options.ts`
- Rankings, see Section 5

Write actions re-check scope on the server: user update and delete, assessment
create, update, and delete, and training session mutations. A trainer acting on
an out-of-scope trainee gets the Hebrew error "המתאמן אינו בסניף שלך".

Admins see everything and get a branch filter on each of these lists,
defaulting to all.

The scope query for admins is skipped entirely so admin pages do not pay for a
join they do not use.

## Section 4: Schedule and shifts

### Branch switcher

The daily board (`/admin/schedule`) and the weekly page
(`/admin/weekly-schedule`) get a branch switcher beside the date controls,
stored in the URL as `?branch=<id>`.

- A trainer in one branch sees only that branch. The switcher is not rendered.
- A trainer in both branches, and any admin, switches between branches.
- The default branch is the first of the caller's branches by `order_index`,
  or חיפה for admins.
- There is no merged view. Each branch is a different physical place with its
  own staffing.
- An invalid or inactive `?branch=` falls back to the default silently, as a
  bad `?date=` does today.

### Forms

Slot, band, and exception forms take `branch_id` from the current switcher.
Nothing new to fill in. The trainee picker inside those forms lists only
trainees of the current branch. The trainer picker lists trainers of the
current branch.

Server-side, the mutate actions validate that `branch_id` is an active branch
and, for trainers, one of the caller's branches.

### Derivation and duplication

On-duty derivation (`src/lib/utils/weekly-schedule.ts`) and whole-day
duplication run per branch: bands, exceptions, and slots are read and written
with the branch id.

Legacy rows with `branch_id` null are treated as חיפה by the read queries until
the backfill in Section 1 runs, after which no such rows exist.

### Clock-in

- A trainer with one branch clocks in as today. The action resolves the branch
  server-side from the trainer's branches.
- A trainer with two branches gets a branch choice rendered above the clock-in
  button in `ShiftStatusCard`. The choice is required before clock-in.
- A trainer with no branch clocks in with `branch_id` null.
- `clockInAction` gains an optional `branchId` argument. The offline queue
  (`use-shift-queue-sync.ts` and the `/api/shifts/sync` route) carries it
  through.
- Admin create and edit shift dialogs get a branch select.
- The shifts table shows a branch column with a filter, admin only.

## Section 5: Rankings

`getRankingsData(ageGroupId, category, branchId)` slices the trainee profile
set to trainees in `profile_branches` for `branchId` before computing
percentiles and leaderboards. The percentile math in `ranking-utils.ts` is
unchanged; it receives a smaller list.

- Staff get a branch select next to the age-group select. Default is the first
  of their branches, or חיפה for admins.
- A trainee sees their own branch. A dual-branch trainee gets a toggle between
  the two.
- A trainee with no branch, or a branch id that resolves to nothing, falls
  back to academy-wide so nobody sees an empty page during rollout.

Rating snapshots and the progress charts are per trainee and unaffected.

## Section 6: Error handling

- Every new server action returns the existing `{ success, data } |
  { success: false, error }` envelope with a Hebrew message.
- Deactivating a branch that still has users or future schedule rows is
  allowed. Those users keep the link; the branch simply disappears from
  pickers. The branches page shows a count of users per branch so Eden can see
  what a deactivation affects.
- The migration wraps backfill in a transaction and raises a notice with the
  row counts it updated, so the prior state is visible in the migration log.

## Section 7: Testing

Pure functions, no mocks, per project rule:

- `resolveBranchScope`: admin, trainer with branches, trainer without.
- `matchArboxBranch(locationName, branches)`: exact match, no match, inactive
  branch ignored, null location.
- Users table branch filter: all, one branch, "ללא סניף", dual-branch user.
- Rankings slice: dual-branch trainee appears in both branches, unassigned
  trainee appears in neither branch view but does in the academy-wide fallback.
- Weekly on-duty derivation with two branches on the same weekday: each
  branch derives only its own bands.

Migration verification: after `supabase db push`, a script counts
`profile_branches` rows against `profiles`, and null `branch_id` rows on the
four schedule and shift tables, expecting zero.

Manual check on the preview deployment as a trainer in one branch, a trainer in
both, and Eden.

## Out of scope

- Per-branch nutrition, courses, or development book content.
- Branch-specific marketing pages or landing copy.
- Trainee-facing schedule. Trainees do not see the schedule today.
- Trainer-to-trainee individual assignment. Scoping is by branch only.
- Deleting a branch.
