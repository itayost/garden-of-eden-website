/**
 * Shared server action utilities
 */

export { verifyAdmin, verifyAdminOrTrainer } from "./verify-admin";
export type { AdminVerifyResult, TrainerVerifyResult } from "./verify-admin";

export { verifyUserAccess } from "./verify-user-access";
export type { UserAccessResult } from "./verify-user-access";
