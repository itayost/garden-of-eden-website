/**
 * Admin user management actions - barrel re-exports
 *
 * All actions are split into focused files:
 * - admin-users-create.ts  — createUserAction
 * - admin-users-update.ts  — updateUserAction
 * - admin-users-delete.ts  — softDeleteUserAction
 * - admin-users-bulk.ts    — bulkCreateUsersAction, BulkImportResult
 *
 * Each file has its own "use server" directive.
 */

export { createUserAction } from "./admin-users-create";
export { updateUserAction } from "./admin-users-update";
export { softDeleteUserAction } from "./admin-users-delete";
export { bulkCreateUsersAction, type BulkImportResult } from "./admin-users-bulk";
