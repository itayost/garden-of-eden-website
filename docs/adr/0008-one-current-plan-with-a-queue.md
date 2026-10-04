# One current plan, the rest queue

A Trainee trains on at most one Plan at a time. Every training Plan bought while another is current, whether online, by staff for cash, transfer or Bit, or by the nightly Arbox import, waits in a queue behind it. A queued Plan starts the day the Plan ahead of it ends, by its end date or, for a Card, by its last session, whichever comes first. Its start date is therefore not known when it is sold. We rejected fixing the start date at purchase time, because a Card that ran out of sessions early left the Trainee unable to book until its date passed, even though the next Plan was already paid for. We also rejected merging a new Card into the current one, because it blurs which payment covered which session and complicates refunds and receipts. Sessions left on a Card when its date passes expire with it, as sold. An Arbox purchase keeps the end date Arbox gave it, so a late-starting Arbox Card has less time than one of ours, whose end date counts from the day it starts.

## Consequences

- Add-ons stay outside the queue.
- The Arbox import no longer merges or extends. It replaces the rules in `docs/superpowers/specs/2026-09-27-arbox-purchase-import-design.md`.
