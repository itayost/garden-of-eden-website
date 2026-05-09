import type {
  ShiftChangeRequestStatus,
  ShiftChangeRequestType,
} from "@/types/database";

export const SHIFT_REQUEST_STATUS_LABELS: Record<ShiftChangeRequestStatus, string> = {
  pending: "ממתין",
  approved: "אושר",
  rejected: "נדחה",
  cancelled: "בוטל",
};

export const SHIFT_REQUEST_STATUS_VARIANTS: Record<
  ShiftChangeRequestStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "outline",
};

export const SHIFT_REQUEST_TYPE_LABELS: Record<ShiftChangeRequestType, string> = {
  edit: "עריכה",
  retro_add: "הוספה",
};
