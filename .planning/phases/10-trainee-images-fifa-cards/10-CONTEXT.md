# Phase 10: Trainee Image Management & FIFA Card Photos - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable admins and coaches to upload trainee photos that display as avatars throughout the app and as professional cutouts on FIFA-style player cards. Includes background removal processing. Photo editing, cropping tools, and batch uploads are separate capabilities.

</domain>

<decisions>
## Implementation Decisions

### Upload Experience
- Upload method: Click to browse (simple file picker, no drag-drop)
- Preview required: Show selected image preview before upload starts, with confirm/cancel
- File limits: Standard restrictions — 5MB max, JPG/PNG only
- Upload trigger placement: Claude's discretion based on existing user management UI patterns

### Processing Feedback
- Failure handling: Block and retry — don't save unprocessed image, show error and let admin try different photo
- Result preview: Show cutout result before saving (cutout only, not before/after comparison)
- Reject option: Include "Try another photo" button after seeing cutout result
- Processing UI: Claude's discretion for spinner/status feedback during background removal

### FIFA Card Integration
- Image position: Centered on card (not top-aligned classic FIFA style)
- Transparency: Card gradient/background visible through transparent areas of cutout
- Image effects: None — clean cutout without drop shadow or glow
- No image fallback: User initials (same style as avatar default)

### Avatar Consistency
- Avatar source: Original photo cropped to circle (not cutout version)
- Consistency: Same avatar appears everywhere (sidebar, dashboard, profile, all locations)
- Default avatar: Initials on colored background when no photo uploaded
- Delete behavior: Revert to initials default when photo is deleted

### Claude's Discretion
- Upload trigger placement in user management UI
- Processing indicator design (spinner, overlay, status text)
- Exact file picker implementation details
- Avatar component sizing for different contexts

</decisions>

<specifics>
## Specific Ideas

- FIFA card: Cutout should let the card's gradient background show through — true transparent cutout effect
- Avatars use original photo (with background), FIFA card uses processed cutout — different sources for different purposes
- User initials fallback is consistent across both avatar and FIFA card when no photo exists

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-trainee-images-fifa-cards*
*Context gathered: 2026-02-01*
