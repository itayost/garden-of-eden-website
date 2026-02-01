# Phase 4: Data Export & Assessment Management - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Export functionality for form submissions, assessments, and user data. Admin ability to delete assessments with audit trail. All exports are admin-facing (not user self-service except GDPR).

</domain>

<decisions>
## Implementation Decisions

### Export File Formats
- CSV with UTF-8 BOM (consistent with Phase 2 pattern for Hebrew in Excel)
- Hebrew column headers (עברית נייטיב)
- Date format: DD/MM/YYYY (Israeli standard)
- File naming: Claude's discretion

### Export Content & Filtering
- Form submissions: Export all fields (no column selection UI)
- Date filtering: Simple date picker for start/end (no presets)
- Assessments: Raw measurements only — no calculated rankings/percentiles
- GDPR per-user export: Profile data, form submissions, assessments, video progress
  - Does NOT include: activity logs, payment history, goals, achievements

### PDF Report Design
- Content: Data table only (no charts)
- Branding: Full branding — logo, colors, styled headers matching the app
- Scope: One PDF per user containing all their assessments
- Layout: RTL (right-to-left) for proper Hebrew document structure

### Assessment Deletion
- Permissions: Admins only (users cannot delete their own assessments)
- Confirmation: Simple yes/cancel dialog (no extra friction)
- Method: Soft delete with `deleted_at` timestamp (recoverable)
- Audit: Show `deleted_at` and `deleted_by` in admin view

### Claude's Discretion
- Export file naming convention
- PDF generation library choice
- Date picker component (shadcn vs custom)
- Error handling for large exports

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-data-export-assessments*
*Context gathered: 2026-02-01*
