import { z } from "zod";
import { phoneField } from "@/lib/validations/enrollment";

/** The dashboard card's one field: a parent's phone, returned as E.164. */
export const parentPhoneSchema = z.object({ phone: phoneField });

export type ParentPhoneInput = z.input<typeof parentPhoneSchema>;
