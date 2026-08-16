/**
 * Barrel for session template actions.
 * Split by concern so each file stays focused; import from here.
 */

export {
  getTemplateAction,
  listTemplatesAction,
} from "./session-templates-list";

export {
  createTemplateAction,
  deleteTemplateAction,
  duplicateTemplateAction,
  updateTemplateAction,
} from "./session-templates-mutate";
