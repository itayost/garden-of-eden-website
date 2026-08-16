# Session templates get their own tables, not one-week programs

A Session template is a named, reusable single-day exercise list. Structurally that looks like a `workout_program` with `weeks = 1`, and reusing the programs tables would have cost no migration and no new management screen — templates would simply have appeared in the existing תוכניות tab, loadable through the `CopyFromProgramDialog` that already exists. We built `session_templates` and `session_template_exercises` instead.

## Why the cheap option was wrong

A program cell stores four things: `sets`, `reps_he`, `load_he`, `notes_he`. A session exercise stores those plus `target_reps`, `target_weight_kg`, `target_duration_seconds`, `target_distance_m`, and it reaches the Equipment behind the exercise for the Performance profile that decides which of those inputs even render.

So a template stored as a one-week program would have been lossy in exactly the place the feature is meant to help. A trainer sets a leg press to 42.5 kg for 9 reps, saves the session as a template, loads it onto the next trainee — and gets a row with an empty free-text load box. Every number that made the composition worth reusing would be gone, and gone silently: nothing about the import would say it had dropped anything.

That is not a gap in the programs schema; it is what a Program is. A Program is a multi-week prescription written before anyone knows which machine is free, which is why its cells are deliberately free text — "8-10", "עד כשל". The Equipment work (`20260814100000`) gave sessions numeric targets precisely because a session is concrete. Widening `workout_program_cells` by four columns per week to serve templates would push that concreteness into a grid that does not want it, and make the program editor render four more inputs per cell per week.

## What the new tables buy

`session_template_exercises` is column-for-column `training_session_exercises` minus the session link. That is the whole design: save and load are the identity function, and `templateToBuilderRows` restores the machine profile from the same `equipment_ref` embed the session loader uses, so an imported row renders the same controls the trainer filled in.

It also keeps the vocabulary honest. `CONTEXT.md` already drew the line between a Slot, a Training session and a Program; a Template is a fourth thing and now says so, instead of being a Program with a magic `weeks` value that readers have to know means something else.

## Consequences

Two copy sources now sit in the builder's ייבוא menu, and a trainer has to know which is which. The menu labels them by source rather than by mechanism (מתבנית / מתוכנית / מאימון קודם), and the template path is listed first because it is the one that round-trips losslessly.

Templates duplicate rather than reference. A session built from a template is an ordinary session from that moment on, and editing the template later does not reach back into days already built — the same rule ADR-0003 set for slots seeded from the weekly schedule. A built day is a record of what was planned, not a live projection.

`SessionRowsEditor` was extracted from `SessionBuilder` so the template editor and the session builder share one row control. They must not drift: a target the session can express and the template cannot is the bug this ADR exists to prevent, and one shared component makes that hard to reintroduce.

Templates are staff-wide, with no per-creator scoping. Trainers at this studio swap shifts and cover for each other, so a template only one author can see would mostly be a template nobody uses. The `created_by_name` snapshot is shown on the card so a trainer can tell whose it is.
