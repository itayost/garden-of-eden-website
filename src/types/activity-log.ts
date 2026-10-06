// Activity Log Types for User Editing Feature

// Activity log entry (matches database schema)
export interface ActivityLog {
  id: string;
  user_id: string;
  action: ActivityAction;
  actor_id: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown> | null;
  changes: FieldChange[] | null;
  created_at: string;
}

// Field change tracking
export interface FieldChange {
  field: string;
  old_value: string | number | boolean | null;
  new_value: string | number | boolean | null;
}

// Hebrew labels for actions; its keys are every action the history knows.
export const ACTIVITY_ACTION_LABELS_HE = {
  user_created: "משתמש נוצר",
  user_updated: "משתמש עודכן",
  user_activated: "משתמש הופעל",
  user_deactivated: "משתמש הושבת",
  role_changed: "תפקיד שונה",
  profile_updated: "פרופיל עודכן",
  stats_created: "סטטיסטיקות נוצרו",
  stats_updated: "סטטיסטיקות עודכנו",
  assessment_created: "מבדק נוצר",
  assessment_updated: "מבדק עודכן",
  plan_granted: "מסלול נרשם",
  invoice_issued: "חשבונית הופקה",
  plan_voided: "ביטול רישום",
  plan_cancelled: "ביטול עסקה",
  plan_ended_early: "סיום מוקדם",
  payment_link_created: "קישור תשלום נשלח",
  slot_called_off: "אימון סומן כבוטל",
  slot_called_off_cleared: "סימון הביטול הוסר",
  age_group_override_changed: "קבוצת גיל שונתה",
} as const satisfies Record<string, string>;

export type ActivityAction = keyof typeof ACTIVITY_ACTION_LABELS_HE;

// Hebrew labels for fields
export const FIELD_LABELS_HE: Record<string, string> = {
  full_name: "שם מלא",
  phone: "טלפון",
  birthdate: "תאריך לידה",
  role: "תפקיד",
  managed_branches: "מנהל/ת סניף",
  is_active: "סטטוס",
  position: "עמדה",
  avatar_url: "תמונת פרופיל",
  club: "מועדון",
  branches: "סניפים",
  age_group_override: "קבוצת גיל",
};

// Hebrew labels for role values
export const ROLE_LABELS_HE: Record<string, string> = {
  trainee: "מתאמן",
  trainer: "מאמן",
  admin: "מנהל",
};
