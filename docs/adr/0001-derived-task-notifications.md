# Task alerts are derived from task rows, not stored as notifications

The admin needs to know when a trainer's task passes its deadline or is closed. Rather than build a notification subsystem, both alerts are computed on read from the task rows themselves: overdue is a still-open task whose due date has passed in Israel time, and awaiting-review is a closed task the admin has not yet acknowledged. There is no notifications table, no delivery channel, and no background job.

## Considered options

**A notifications table with an unread inbox.** Rejected for now. It is a genuinely reusable subsystem, but nothing else in the product needs one yet, and it would introduce a second source of truth that can drift from the task rows — a notification saying "overdue" that survives after the deadline was extended is worse than no notification.

**WhatsApp push to the admin.** Rejected. The WhatsApp client exists but has only ever messaged leads and trainees. Business-initiated messages outside the 24-hour customer service window require a Meta-approved template, so this is days of approval latency for the first message, plus an admin phone number in config and a spam risk once task volume grows.

**Nothing but a page the admin visits.** Rejected as too weak — without a count surfaced in the navigation, a closed task is only discovered by chance.

## Consequences

The admin is not pushed anything. They learn about overdue and closed tasks by being in the app and seeing the count on the navigation item. This is a deliberate acceptance: it matches how every other "needs attention" signal in this codebase already works, and it means the feature ships with one table and one nullable timestamp column instead of a subsystem.

Acknowledgement is explicit, one click per task, rather than clearing automatically when the page renders. The point of the alert is that the work gets reviewed and can be reopened, so a counter that resets on a glance would defeat it.

If a push channel is added later, the derived queries stay as they are and the channel reads from them — this decision does not have to be unwound first.
