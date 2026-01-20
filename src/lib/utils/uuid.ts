import { z } from "zod";

/**
 * UUID validation schema
 * Validates that a string is a valid UUID v4 format
 */
export const uuidSchema = z.string().uuid();

/**
 * Check if a string is a valid UUID
 * @param value - The string to validate
 * @returns true if the string is a valid UUID, false otherwise
 */
export function isValidUUID(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}
