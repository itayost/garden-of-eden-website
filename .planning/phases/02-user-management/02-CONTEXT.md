# Phase 2: Admin Panel - User Management - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin interface for managing users: create new trainees/coaches/admins, view and search user list, reset passwords, soft-delete users, and bulk import/export. Individual user profile editing and self-service settings are separate phases.

</domain>

<decisions>
## Implementation Decisions

### User Creation Flow
- Required fields: Name + Phone (role selected by admin)
- Three roles available: Admin, Coach, Trainee
- Position NOT set by admin — trainees fill this during onboarding wizard
- Form lives on separate page (`/admin/users/create`), not modal

### User List Layout
- Data table format (rows with sortable columns)
- Columns: Avatar, Name, Phone, Role, Status, Payment Status
- Row click navigates to user profile page (actions live there, not inline)
- Deleted users hidden by default (toggle/filter to show)

### Search & Filter
- Real-time search (updates as you type, debounced)
- Filters inline above table (dropdowns/chips row)
- Priority filters: Role, Status (shown prominently)
- Payment and Position filters available but secondary

### Bulk Operations
- CSV import with full columns: Name, Phone, Role, Email
- Invalid rows skipped during import, with report of what was skipped and why
- Export to CSV only (no Excel)

### Claude's Discretion
- Credentials delivery method (SMS temp password vs magic link) — follow existing auth patterns
- URL state persistence for filters — pick best practice
- Bulk status update UI (checkboxes vs individual only) — balance complexity vs value

</decisions>

<specifics>
## Specific Ideas

- Trainees set their own position in onboarding, so admin creation form doesn't include position
- Click-through to profile page keeps the list clean and consolidates all user actions in one place

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-user-management*
*Context gathered: 2026-02-01*
