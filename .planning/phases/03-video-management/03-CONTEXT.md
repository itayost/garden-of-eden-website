# Phase 3: Video Management - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin video CRUD for managing training videos. Admins can create, edit, and delete videos. User-side features (progress tracking, resume, analytics) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Video form fields
- Extended field set: title, YouTube URL, day, topic/category, duration, description
- Additional fields: thumbnail override, target audience, difficulty level
- YouTube URL handling: Accept any format (youtube.com/watch, youtu.be, embed) — auto-extract video ID

### Video table
- Compact columns: thumbnail, title, day, duration, actions
- Flat list organization (single sortable table, not grouped by day)
- Standard sorting by any column

### Claude's Discretion
- Form layout and field order
- Thumbnail extraction from YouTube API vs manual upload
- Validation rules for each field
- Table pagination approach

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for admin CRUD interfaces.

</specifics>

<deferred>
## Deferred Ideas

- **Drag-to-reorder** — User explicitly removed from this phase
- **Analytics dashboard** — View counts, completion rates, watch time metrics
- **User-side progress tracking** — Save watch progress, completion status
- **"Continue watching" UI** — Resume section for partially watched videos

</deferred>

---

*Phase: 03-video-management*
*Context gathered: 2026-02-01*
