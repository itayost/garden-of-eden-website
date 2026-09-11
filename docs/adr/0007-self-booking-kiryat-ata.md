# קריית אתא slots are projected forward and filled by trainees

ADR-0002 made the board staff-authored and ADR-0003 materialized slots
only when a human pressed "build". Both stand for חיפה. For קריית אתא,
where trainees buy plans in the app and are promised they can book their
own trainings, a slot must exist before anyone asks for it.

## Decision

A weekly band may be marked bookable with a capacity. For a branch with
bookable bands, a daily job projects the next 14 days of those bands into
rosterless slots, respecting absences and extras through the same
`deriveOnDuty` the board uses. Trainees then add themselves to those
slots through server actions that enforce plan eligibility, weekly caps,
a 14-day window, a 3-hour cancellation cutoff, and capacity, the last
inside one Postgres function that locks the slot row.

Staff keep every power they have: they build, edit, delete, and over-fill
slots by hand. A slot staff delete is tombstoned so the projection does
not put it back. Nothing about חיפה changes, because no חיפה band is
bookable.

## Consequences

The daily WhatsApp roster message still works; it now lists names the
trainees typed themselves. A roster row gains `source`, `booked_at`,
`cancelled_at`, and `late_cancel`, and plan usage counts late cancels as
used sessions. RLS stays staff-only on slot tables; trainee access is
mediated by actions, matching how plans are read.

## Revisit when

חיפה moves off Arbox for bookings, or capacity needs a waitlist.
