"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { UseFormReturn, FieldValues, DefaultValues } from "react-hook-form";
import { toast } from "sonner";
import { saveDraft, loadDraft, removeDraft, hasMeaningfulData } from "../lib/storage";
import type { UseFormDraftOptions, UseFormDraftReturn } from "../types";

const DEFAULT_EXPIRY_DAYS = 7;
const DEFAULT_AUTO_SAVE_INTERVAL = 10000; // 10 seconds

/**
 * Custom hook for managing form drafts with auto-save and restoration
 *
 * @example
 * ```tsx
 * const form = useForm<MyFormData>({
 *   resolver: zodResolver(mySchema),
 *   defaultValues: { ... }
 * });
 *
 * const draft = useFormDraft(form, {
 *   formId: "my-form",
 * });
 *
 * // In onSubmit after success:
 * draft.clearDraft();
 * ```
 */
export function useFormDraft<TFormData extends FieldValues>(
  form: UseFormReturn<TFormData>,
  options: UseFormDraftOptions,
  defaultValues: DefaultValues<TFormData>
): UseFormDraftReturn {
  const {
    formId,
    expiryDays = DEFAULT_EXPIRY_DAYS,
    autoSaveInterval = DEFAULT_AUTO_SAVE_INTERVAL,
  } = options;

  const [isDraftAvailable, setIsDraftAvailable] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Clear draft from storage and cancel any pending auto-save
  const clearDraft = useCallback(() => {
    // Cancel pending auto-save to prevent race condition
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    removeDraft(formId);
    setIsDraftAvailable(false);
    setLastSaved(null);
    setHasUnsavedChanges(false);
  }, [formId]);

  // Discard draft and reset form to defaults
  const discardDraft = useCallback(() => {
    clearDraft();
    form.reset(defaultValues);
    toast.success("הטיוטה נמחקה");
  }, [clearDraft, form, defaultValues]);

  // Restore draft to form
  const restoreDraft = useCallback(() => {
    const draft = loadDraft<TFormData>(formId);
    if (draft) {
      form.reset(draft.data);
      setIsDraftAvailable(false);
      setHasUnsavedChanges(true);
      toast.success("הטיוטה שוחזרה");
    }
  }, [form, formId]);

  // Check for existing draft on mount
  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;

    const draft = loadDraft<TFormData>(formId);
    if (draft) {
      setIsDraftAvailable(true);
      setLastSaved(new Date(draft.metadata.savedAt));

      // Restore draft immediately and show toast with discard option
      form.reset(draft.data);
      setHasUnsavedChanges(true);

      const savedDate = new Date(draft.metadata.savedAt);
      const formattedDate = savedDate.toLocaleDateString("he-IL", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      toast("טיוטה שוחזרה", {
        description: `נשמרה ב-${formattedDate}`,
        action: {
          label: "מחק טיוטה",
          onClick: discardDraft,
        },
        duration: 10000,
      });
    }
  }, [formId, form, discardDraft]);

  // Auto-save functionality with debouncing
  useEffect(() => {
    const subscription = form.watch((data) => {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Check if there's meaningful data to save
      if (!hasMeaningfulData(data as TFormData, defaultValues as TFormData)) {
        return;
      }

      setIsAutoSaving(true);
      setHasUnsavedChanges(true);

      // Set new timer for debounced save
      autoSaveTimerRef.current = setTimeout(() => {
        const currentValues = form.getValues();
        saveDraft(formId, currentValues, expiryDays);
        setLastSaved(new Date());
        setIsAutoSaving(false);
      }, autoSaveInterval);
    });

    return () => {
      subscription.unsubscribe();
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [form, formId, expiryDays, autoSaveInterval, defaultValues]);

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return {
    isDraftAvailable,
    isAutoSaving,
    lastSaved,
    clearDraft,
  };
}
