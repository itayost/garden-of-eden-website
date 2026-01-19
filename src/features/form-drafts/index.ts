/**
 * Form Drafts Feature
 *
 * Auto-saves form data to localStorage and restores on page load.
 *
 * @example
 * ```tsx
 * import { useFormDraft } from "@/features/form-drafts";
 *
 * const defaultValues = { name: "", email: "" };
 *
 * const form = useForm({
 *   resolver: zodResolver(schema),
 *   defaultValues,
 * });
 *
 * const draft = useFormDraft(form, { formId: "my-form" }, defaultValues);
 *
 * // After successful submission:
 * draft.clearDraft();
 * ```
 */

export { useFormDraft } from "./hooks/useFormDraft";
export type { UseFormDraftOptions, UseFormDraftReturn } from "./types";
