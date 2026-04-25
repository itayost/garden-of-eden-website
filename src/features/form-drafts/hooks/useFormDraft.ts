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

  const [initialDraft] = useState(() => loadDraft<TFormData>(formId));
  const hasInitialDraft = !!initialDraft;

  const [isDraftAvailable, setIsDraftAvailable] = useState(hasInitialDraft);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(
    initialDraft ? new Date(initialDraft.metadata.savedAt) : null
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(hasInitialDraft);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDoneRef = useRef(false);
  // Refs guard the hot watcher path so we only call setState on transitions,
  // not on every keystroke.
  const isAutoSavingRef = useRef(false);
  const hasUnsavedChangesRef = useRef(hasInitialDraft);
  // Latest defaultValues kept in a ref so the autosave effect dependency list
  // stays stable across parent re-renders (which would otherwise tear down
  // and re-create the form-watch subscription on every render).
  const defaultValuesRef = useRef(defaultValues);
  useEffect(() => {
    defaultValuesRef.current = defaultValues;
  }, [defaultValues]);

  // Clear draft from storage and cancel any pending auto-save
  const clearDraft = useCallback(() => {
    // Cancel pending auto-save to prevent race condition
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    removeDraft(formId);
    isAutoSavingRef.current = false;
    hasUnsavedChangesRef.current = false;
    setIsDraftAvailable(false);
    setLastSaved(null);
    setHasUnsavedChanges(false);
    setIsAutoSaving(false);
  }, [formId]);

  // Discard draft and reset form to defaults
  const discardDraft = useCallback(() => {
    clearDraft();
    form.reset(defaultValues);
    toast.success("הטיוטה נמחקה");
  }, [clearDraft, form, defaultValues]);

  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;

    if (!initialDraft) return;

    form.reset(initialDraft.data);

    const formattedDate = new Date(initialDraft.metadata.savedAt).toLocaleDateString(
      "he-IL",
      { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    );

    toast("טיוטה שוחזרה", {
      description: `נשמרה ב-${formattedDate}`,
      action: {
        label: "מחק טיוטה",
        onClick: discardDraft,
      },
      duration: 10000,
    });
  }, [initialDraft, form, discardDraft]);

  // Auto-save functionality with debouncing
  useEffect(() => {
    const subscription = form.watch((data) => {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Check if there's meaningful data to save
      if (!hasMeaningfulData(data as TFormData, defaultValuesRef.current as TFormData)) {
        return;
      }

      // Only call setState on the transition false -> true. After that the
      // ref short-circuits all subsequent keystrokes.
      if (!isAutoSavingRef.current) {
        isAutoSavingRef.current = true;
        setIsAutoSaving(true);
      }
      if (!hasUnsavedChangesRef.current) {
        hasUnsavedChangesRef.current = true;
        setHasUnsavedChanges(true);
      }

      // Set new timer for debounced save
      autoSaveTimerRef.current = setTimeout(() => {
        const currentValues = form.getValues();
        saveDraft(formId, currentValues, expiryDays);
        setLastSaved(new Date());
        isAutoSavingRef.current = false;
        setIsAutoSaving(false);
      }, autoSaveInterval);
    });

    return () => {
      subscription.unsubscribe();
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [form, formId, expiryDays, autoSaveInterval]);

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
