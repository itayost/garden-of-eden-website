/**
 * Form draft types and interfaces
 */

export interface DraftMetadata {
  savedAt: number;
  expiresAt: number;
  formId: string;
}

export interface Draft<TData> {
  data: TData;
  metadata: DraftMetadata;
}

export interface UseFormDraftOptions {
  /** Unique identifier for this form's drafts */
  formId: string;
  /** Number of days before draft expires (default: 7) */
  expiryDays?: number;
  /** Auto-save interval in milliseconds (default: 10000 = 10s) */
  autoSaveInterval?: number;
}

export interface UseFormDraftReturn {
  /** Whether a draft exists that hasn't been restored yet */
  isDraftAvailable: boolean;
  /** Whether currently saving a draft */
  isAutoSaving: boolean;
  /** Timestamp of last save */
  lastSaved: Date | null;
  /** Manually clear the draft from storage */
  clearDraft: () => void;
}
