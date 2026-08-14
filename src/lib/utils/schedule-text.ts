/**
 * Generates the daily WhatsApp schedule message from structured slots.
 *
 * The admin used to hand-type this message every day; now the slots are the
 * source of truth and this text is the output, copied to the clipboard with
 * one tap. Format per time group:
 *
 *   15:00
 *   דין (מגרש): נועם חלבי, יהלי, איתי
 *   זריזות מהירות טכניקה עם כדור
 *
 * Blank line between slots and between time groups.
 */

import type { ScheduleSlot } from "@/types/schedule";

/** Postgres TIME serializes as HH:MM:SS; the message shows HH:MM. */
function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatSlot(slot: ScheduleSlot): string {
  const names = [...slot.trainees]
    .sort((a, b) => a.order_index - b.order_index)
    .map((trainee) => trainee.trainee_name)
    .join(", ");

  // The location renders even without a trainer — the admin entered it, and
  // "which field the group is on" matters regardless of who takes them.
  const header = [
    slot.trainer_name,
    slot.location_he ? `(${slot.location_he})` : null,
  ]
    .filter(Boolean)
    .join(" ");
  // A slot seeded from the weekly schedule carries an hour and a trainer but no
  // roster until the names are filled in. The colon introduces the names, so
  // with no names there is nothing to introduce — "דין: " with a dangling colon
  // reads as a broken message, not as an empty group.
  const rosterLine = names ? (header ? `${header}: ${names}` : names) : header;

  const lines = rosterLine ? [rosterLine] : [];
  if (slot.focus_he) lines.push(slot.focus_he);
  return lines.join("\n");
}

export function buildScheduleWhatsAppText(slots: readonly ScheduleSlot[]): string {
  if (slots.length === 0) return "";

  const byTime = new Map<string, ScheduleSlot[]>();
  for (const slot of slots) {
    const time = formatTime(slot.start_time);
    const group = byTime.get(time) ?? [];
    byTime.set(time, [...group, slot]);
  }

  const times = [...byTime.keys()].sort();

  // The time header stays attached to its first slot; additional slots at the
  // same hour, and each new time group, are separated by a blank line.
  return times
    .map((time) => {
      const group = byTime.get(time)!;
      // A slot with no trainer, no location and no roster renders as nothing;
      // dropping it keeps the hour from trailing a blank line.
      const body = group.map(formatSlot).filter(Boolean).join("\n\n");
      return body ? `${time}\n${body}` : time;
    })
    .join("\n\n");
}
