import { z } from "zod";
import { isSleepHours } from "@/features/checkins/lib/checkin";

/** A Trainee's Check-in as the card sends it. The date is always the server's. */
export const checkinSchema = z.object({
  sleepHours: z.number().refine(isSleepHours, "שעות שינה לא תקינות"),
  energy: z.number().int("רמת אנרגיה לא תקינה").min(1, "רמת אנרגיה לא תקינה").max(5, "רמת אנרגיה לא תקינה"),
  soreness: z.boolean({ message: "יש לענות על עייפות השרירים" }),
});

export type CheckinInput = z.infer<typeof checkinSchema>;
