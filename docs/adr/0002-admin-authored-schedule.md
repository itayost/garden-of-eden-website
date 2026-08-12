# The daily schedule is admin-authored, not synced from Arbox

The academy uses Arbox, and Arbox has a schedule API — so the obvious design was to pull the daily schedule from there. We deliberately did not. The admin builds the day by hand in a structured builder, and the WhatsApp message is generated from it.

## Why

Two facts decided it. First, bookings are not reliably managed in Arbox — the operational truth of "who comes at what hour with which trainer" lives in the admin's head and in the WhatsApp message he types, so Arbox data would be wrong on the days it matters. Second, the Arbox schedule resources (`GET /v3/schedule`, `classesSummary`, `futureSessions`) return per-class registered *counts* and a coach name, not a per-trainee roster; the only per-trainee data (`entranceReport`) is historical check-ins, not a plan. Auto-population would still leave the admin editing every slot by hand.

## Consequences

The schedule requires a few minutes of staff input each morning, mitigated by day duplication.

> Amended 2026-08-12: "admin-authored" now means staff-authored. Trainers may
> create, edit, and delete slots so the board can be built from a phone in the
> studio; whole-day duplication remains admin-only. The decision above — hand
> authored, not synced from Arbox — is unchanged.
 Roster entries allow free-text names precisely because the source is a human list, not a registration system.

## Revisit when

The academy starts enforcing bookings in Arbox, or Arbox exposes per-trainee rosters on schedule resources. The slot model does not change either way — only where rows come from.
