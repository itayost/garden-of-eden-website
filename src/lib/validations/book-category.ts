import { z } from "zod";

/**
 * Validation schema for book category create/update operations.
 */
export const categorySchema = z.object({
  slug: z
    .string()
    .min(1, "נדרש מזהה קטגוריה")
    .max(80, "מזהה ארוך מדי")
    .regex(/^[a-z0-9-]+$/, "מזהה חייב להכיל אותיות לועזיות קטנות, ספרות ומקפים בלבד"),
  name_he: z
    .string()
    .min(1, "נדרש שם קטגוריה")
    .max(120, "שם ארוך מדי"),
  icon: z.string().max(50).optional(),
  order_index: z.number().int().optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
