/**
 * Webhook Validation Schemas
 *
 * Zod schemas for validating webhook payloads with safe number parsing.
 */

import { z } from "zod";

/**
 * Safely parse an integer from a string.
 * Returns the parsed number, or the default value if NaN or empty.
 *
 * @param value - String value to parse
 * @param defaultValue - Default value if parsing fails (default: 0)
 * @returns Parsed integer or default value
 *
 * @example
 * ```ts
 * safeParseInt("5") // 5
 * safeParseInt("") // 0
 * safeParseInt("abc") // 0
 * safeParseInt("abc", 1) // 1
 * ```
 */
export function safeParseInt(value: string, defaultValue: number = 0): number {
  if (!value || value.trim() === "") {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safely parse a float from a string.
 * Returns the parsed number, or null if NaN or empty.
 *
 * @param value - String value to parse
 * @returns Parsed float or null
 *
 * @example
 * ```ts
 * safeParseFloat("99.50") // 99.50
 * safeParseFloat("") // null
 * safeParseFloat("abc") // null
 * ```
 */
export function safeParseFloat(value: string): number | null {
  if (!value || value.trim() === "") {
    return null;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Custom fields schema for webhook payload
 */
const customFieldsSchema = z
  .object({
    cField1: z.string().optional(),
    cField2: z.string().optional(),
  })
  .catchall(z.string().optional());

/**
 * GROW webhook data schema with safe number parsing transforms.
 *
 * The GROW API sends numeric values as strings. This schema transforms
 * them to proper numbers while handling NaN gracefully:
 * - paymentsNum / allPaymentsNum: default to 1 on NaN
 * - firstPaymentSum / periodicalPaymentSum: null on NaN
 */
export const growWebhookDataSchema = z.object({
  asmachta: z.string(),
  cardSuffix: z.string(),
  cardType: z.string(),
  cardTypeCode: z.string(),
  cardBrand: z.string(),
  cardBrandCode: z.string(),
  cardExp: z.string(),
  firstPaymentSum: z.string().transform((val) => safeParseFloat(val)),
  periodicalPaymentSum: z.string().transform((val) => safeParseFloat(val)),
  status: z.string(),
  statusCode: z.string(),
  transactionTypeId: z.string(),
  paymentType: z.string(),
  sum: z.string(),
  paymentsNum: z.string().transform((val) => safeParseInt(val, 1)),
  allPaymentsNum: z.string().transform((val) => safeParseInt(val, 1)),
  paymentDate: z.string(),
  description: z.string(),
  fullName: z.string(),
  payerPhone: z.string(),
  payerEmail: z.string(),
  transactionId: z.string(),
  transactionToken: z.string(),
  processId: z.string(),
  processToken: z.string(),
  payerBankAccountDetails: z.string().optional().default(""),
  customFields: customFieldsSchema.optional(),
});

/**
 * Full GROW webhook payload schema
 */
export const growWebhookSchema = z.object({
  err: z.string(),
  status: z.string(),
  data: growWebhookDataSchema,
});

/**
 * Inferred type for validated GROW webhook data
 */
export type GrowWebhookData = z.infer<typeof growWebhookDataSchema>;

/**
 * Inferred type for full validated GROW webhook payload
 */
export type GrowWebhookPayload = z.infer<typeof growWebhookSchema>;
