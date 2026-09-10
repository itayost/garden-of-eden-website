# Branches are a table, not free text

The academy operates in two places, חיפה and קריית אתא. A branch is a real entity: `branches` is an admin-editable lookup table and `profile_branches` links each user to one branch or both. Schedule bands, exceptions, slots and shifts carry a `branch_id`.

This reverses the inline decision in `20260815120000_weekly_schedule.sql`, which kept `location_he` as free text rather than introduce a locations table. That was right when there was one academy and "location" meant the room. It stops being right once a trainer in קריית אתא must not see the חיפה roster, because a filter cannot be built on text someone typed.

`location_he` stays and keeps its old meaning: the room or field within a branch.

## Considered options

**An enum column on profiles.** Rejected. A user can belong to both branches, so a single column cannot express membership, and this codebase has no enums on profiles by convention.

**A `branch_ids uuid[]` array on profiles.** Rejected. No foreign key integrity, awkward filters, and no precedent. The `book_drill_muscles` join is the pattern the codebase already has.

**Enforcing trainer scope in RLS.** Rejected for now. The profiles policies already recursed once (42P17), and the staff pick-lists deliberately read through the service role, so RLS alone would not restrict those reads. Scope is applied in server queries through one helper, `resolveBranchScope`.

## Consequences

**Membership reads for other users need the service role.** `profile_branches` lets a user read only their own rows. Every trainer-facing list that needs another user's branches reads through `createAdminClient()` inside an action gated by `verifyAdminOrTrainer()`.

**Arbox can fill branches, but does not today.** All Arbox clients currently share one location name. `branches.arbox_location_name` is the hook; it is null until Eden splits Arbox, and the sync only fills a profile whose `branches_set_by_admin_at` is null.

**Deactivating a branch hides it, never deletes.** Memberships and history keep pointing at it.
