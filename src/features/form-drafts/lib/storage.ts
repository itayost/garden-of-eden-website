/**
 * localStorage-based draft storage utility
 */

import type { Draft, DraftMetadata } from "../types";

const DRAFT_PREFIX = "goe_form_draft_";
const DEFAULT_EXPIRY_DAYS = 7;

/**
 * Get the storage key for a form
 */
function getKey(formId: string): string {
  return `${DRAFT_PREFIX}${formId}`;
}

/**
 * Save draft data to localStorage
 */
export function saveDraft<TData>(
  formId: string,
  data: TData,
  expiryDays: number = DEFAULT_EXPIRY_DAYS
): void {
  try {
    const now = Date.now();
    const expiresAt = now + expiryDays * 24 * 60 * 60 * 1000;

    const draft: Draft<TData> = {
      data,
      metadata: {
        savedAt: now,
        expiresAt,
        formId,
      },
    };

    localStorage.setItem(getKey(formId), JSON.stringify(draft));
  } catch (error) {
    // Silently fail - localStorage might be full or unavailable
    console.error("Failed to save form draft:", error);
  }
}

/**
 * Load draft data from localStorage
 * Returns null if draft doesn't exist, is expired, or is corrupted
 */
export function loadDraft<TData>(formId: string): Draft<TData> | null {
  try {
    const key = getKey(formId);
    const stored = localStorage.getItem(key);

    if (!stored) return null;

    const draft: Draft<TData> = JSON.parse(stored);

    // Check expiration
    if (Date.now() > draft.metadata.expiresAt) {
      removeDraft(formId);
      return null;
    }

    return draft;
  } catch (error) {
    // Remove corrupted data
    removeDraft(formId);
    console.error("Failed to load form draft:", error);
    return null;
  }
}

/**
 * Remove draft from localStorage
 */
export function removeDraft(formId: string): void {
  try {
    localStorage.removeItem(getKey(formId));
  } catch (error) {
    console.error("Failed to remove form draft:", error);
  }
}

/**
 * Check if draft data has meaningful content (not just empty defaults)
 */
export function hasMeaningfulData<TData extends Record<string, unknown>>(
  data: TData,
  defaultValues: TData
): boolean {
  return Object.entries(data).some(([key, value]) => {
    const defaultValue = defaultValues[key];

    // Check if value differs from default
    if (value !== defaultValue) {
      // Exclude empty strings, null, undefined
      if (value === "" || value === null || value === undefined) {
        return false;
      }
      return true;
    }
    return false;
  });
}
