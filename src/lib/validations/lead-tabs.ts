import { z } from "zod";
import { LEAD_TAB_COLORS } from "@/types/lead-tabs";

// Application-layer regex: stricter than the DB CHECK (which allows leading
// or trailing dashes). Slugs must start and end with an alphanumeric character;
// underscores/dashes are only allowed in the middle. Length 1–50.
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9_-]{0,48}[a-z0-9])?$/;

/**
 * Convert a human label into a slug.
 * - Lowercases.
 * - Replaces any run of characters outside [a-z0-9] with a single dash.
 * - Strips leading/trailing dashes and underscores.
 * - Truncates to 50 characters (the DB column constraint).
 * - Returns "tab" if the result is empty (e.g. Hebrew-only or punctuation-only input).
 */
export function deriveLeadTabSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 50)
    .replace(/^[-_]+|[-_]+$/g, "");
  return base.length > 0 ? base : "tab";
}

export const leadTabSlugSchema = z
  .string()
  .regex(SLUG_REGEX, "מזהה טאב לא תקין");

export const leadTabNameSchema = z
  .string()
  .trim()
  .min(1, "חובה למלא שם")
  .max(80, "שם ארוך מדי");

export const leadTabColorSchema = z
  .enum(LEAD_TAB_COLORS)
  .nullable()
  .optional();

export const leadTabCreateSchema = z.object({
  name: leadTabNameSchema,
  slug: leadTabSlugSchema.optional(),
  color: leadTabColorSchema,
  is_default: z.boolean().optional().default(false),
});
export type LeadTabCreateInput = z.infer<typeof leadTabCreateSchema>;

export const leadTabUpdateSchema = z.object({
  id: z.string().uuid("מזהה לא תקין"),
  name: leadTabNameSchema.optional(),
  color: leadTabColorSchema,
  is_default: z.boolean().optional(),
});
export type LeadTabUpdateInput = z.infer<typeof leadTabUpdateSchema>;

export const leadTabReorderSchema = z.object({
  ordered_ids: z.array(z.string().uuid()).min(1, "סדר הטאבים ריק"),
});
export type LeadTabReorderInput = z.infer<typeof leadTabReorderSchema>;

export const leadTabDeleteSchema = z.object({
  id: z.string().uuid("מזהה לא תקין"),
  move_to_tab_id: z.string().uuid("יש לבחור טאב יעד"),
});
export type LeadTabDeleteInput = z.infer<typeof leadTabDeleteSchema>;
