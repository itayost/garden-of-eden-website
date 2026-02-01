# Phase 5: Profile & Settings - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Self-service settings page for admin and coach roles to edit their profile, manage preferences, and handle account settings. **Trainees do not have access to a settings page** — their profile data is managed by admin/coaches.

</domain>

<decisions>
## Implementation Decisions

### Access Control
- Settings page is ONLY visible to admin and coach roles
- Trainees do not see Settings in their navigation
- Trainees cannot self-edit their profile (admin/coach manages it)
- No self-service GDPR actions for trainees (admin handles requests)

### Tab Organization
- 3 tabs: Profile, Preferences, Account
- Horizontal scrollable tabs on mobile
- URL-addressable tabs using query param (e.g., `/settings?tab=account`)
- Warn before switching tabs with unsaved changes (alert dialog)

### Save Behavior
- Explicit save button (not auto-save)
- Toast notification on successful save
- Cancel button to reset changes to last saved values

### Avatar Management
- Crop tool available after selecting image
- Confirmation dialog required before avatar deletion
- Initials on colored background as fallback when no avatar

### Account Deletion
- Standard confirmation dialog (not type-to-confirm)
- Soft delete with 30-day recovery period (uses existing soft delete pattern)
- Data export is separate action, not part of deletion flow
- Redirect to home page (/) with "Account deleted" message after deletion

### Claude's Discretion
- Per-tab vs per-section save buttons
- Avatar upload timing (immediate vs with save button)
- Tab component implementation
- Color generation for initials fallback

</decisions>

<specifics>
## Specific Ideas

- Use nuqs for URL state (consistent with existing user table patterns)
- Reuse existing ImageUpload component for avatar
- Follow existing toast pattern from admin actions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-profile-settings*
*Context gathered: 2026-02-01*
