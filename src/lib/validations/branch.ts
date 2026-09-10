import { z } from "zod";
import { PHONE_REGEX_IL, UUID_REGEX } from "@/lib/validations/common";

/** Trims, then treats an empty string as "no value" so the DB stores NULL. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `הטקסט ארוך מדי (מקסימום ${max} תווים)`)
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null);

export const branchSchema = z.object({
  name_he: z.string().trim().min(1, "נדרש שם סניף").max(60, "שם ארוך מדי"),
  arbox_location_name: optionalText(120),
  manager_phone: optionalText(20).refine(
    (v) => v === null || PHONE_REGEX_IL.test(v),
    "מספר טלפון לא תקין",
  ),
  is_active: z.boolean().default(true),
});

export type BranchInput = z.input<typeof branchSchema>;

export const branchIdListSchema = z
  .array(z.string().regex(UUID_REGEX, "מזהה סניף לא תקין"))
  .max(20, "יותר מדי סניפים");

export const reorderBranchesSchema = z.object({
  ids: branchIdListSchema.min(1, "אין סניפים לסדר"),
});
