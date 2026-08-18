# On-duty staffing is derived from the weekly schedule; slots are materialised only on request

The weekly schedule stores Bands — who covers which stretch of which weekday — and dated Exceptions. It does not store what any particular date looks like. "Who is on duty on 16.8" is computed on every read from the Bands for that weekday with that date's Exceptions applied, by one pure function (`src/lib/utils/weekly-schedule.ts`). Slots, by contrast, are real rows, and the weekly schedule creates them only when a human presses "בנה מהלוח השבועי".

## Why derive the staffing

This is ADR-0001's rule applied to a second feature: no stored copy that can drift from the thing it was copied from. A materialised `on_duty` table would need rewriting every time a Band moved, and the failure mode is silent — the board would keep showing last month's staffing with nothing to indicate it was stale. Deriving costs two indexed queries and a filter over a few dozen rows.

It also makes Exceptions cheap. An absence is one row that changes what one date derives to; it edits nothing, so next Sunday is untouched and the standing week never has to be edited-and-reverted around a vacation.

## Why materialise the slots anyway

Slots are not a view of the weekly schedule — they are a separate document that the week merely seeds. Two facts force this:

The week does not know the roster. A Band says "לידור, 15:00–18:00, סטודיו"; a Slot additionally needs the names, which exist only in the admin's head that morning. A derived slot could never carry them.

Slots are edited per day. A trainer swaps, a group merges, an hour shifts — all normal, and all meaningless against a standing weekly pattern. Once a day's board diverges from its template, "derive it from the week" has no answer.

So the button copies, and what it produces is ordinary slot rows that staff own from that moment on. Changing a Band later does not reach back into days already built. That is intended: a built day is a record of what was planned, not a live projection.

## Consequences

Seeded slots have no roster, which was previously impossible. `slotSchema` still requires at least one roster entry — that rule guards what a human saves through the form, and it keeps guarding it. The build action inserts through its own path instead, so a seeded slot is explicitly half-built: the card shows "הוספת מתאמנים" rather than an empty badge row, and the WhatsApp text renders the header without a dangling colon. Opening one to edit forces the names in.

Standby Bands ("חיזוק במידת הצורך") are shown on the day but never seeded. A slot on the board asserts that a group is happening, and standby means precisely that nobody has decided yet.

## Considered options

**Nightly cron that builds tomorrow's board.** Rejected. It contradicts ADR-0002 — the board is staff-authored, and nothing appears on it unasked. Rows would materialise on holidays and vacations, and the admin would spend the morning deleting instead of typing, which is worse than the problem.

**Expanding a Band into one slot per hour.** Rejected. "15:00–18:00, לידור + נדב" would become six rows, and the studio does not run six separate groups — it runs a stretch. Deleting five wrong rows per band is not a head start.

**Making the weekly schedule write `trainer_shifts`.** Deferred, not rejected. Bulk shift entry is currently done by hand-writing SQL migrations (eleven such files exist), so the weekly schedule is the obvious source. It is out of scope here because `trainer_shifts` is payroll-relevant and trainer-attested: rows a trainer did not clock should not appear in it without a separate decision about what "expected" means. The derived queries would not need unwinding first — an expected-versus-actual column reads the same function this ADR is about.

## Revisit when

Days routinely diverge from the week enough that the seed stops saving time, or the academy wants the weekly schedule to answer for attendance rather than only for planning.

## Amendment: the weekly page shows a dated week too

`/admin/weekly-schedule` now has two tabs. "תבנית קבועה" is the standing week this ADR describes, unchanged. "השבוע הזה" is a real dated week that reads `daily_schedule_slots` for the seven dates on screen.

Nothing above is reversed. Staffing is still derived and never stored, slots are still materialised only on request, and a slot still never writes back to a Band. What changed is that a second surface renders slots, which had two consequences worth recording.

Deriving is what makes the week cheap. Seven days of staffing come from one Bands read and one Exceptions read, composed by `buildWeek` in `src/lib/utils/schedule-week.ts` calling `deriveOnDuty` per date. A materialised `on_duty` table would have made the week view seven lookups against rows that could each be stale.

The one-way rule is what made the dated week necessary. A slot created on the daily board could not appear on a page that only knew weekdays, and the surprise that caused is what prompted this. The answer is a surface with dates on it, not a write-back: a slot on 18.8 still says nothing about every Tuesday.

Two smaller decisions follow from the same reasoning. Saturday appears only when it holds a slot or a one-off extra — the academy does not staff it, but a slot written there is real and must not be invisible. And a day that already has a board shows only that date's deviations, since the routine staffing is already in the slots and repeating it would be the stale-copy problem in visual form.
