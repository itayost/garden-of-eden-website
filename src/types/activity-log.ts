// Activity Log Types for User Editing Feature

// Activity action types
export const ACTIVITY_ACTIONS = {
  USER_CREATED: "user_created",
  USER_UPDATED: "user_updated",
  USER_ACTIVATED: "user_activated",
  USER_DEACTIVATED: "user_deactivated",
  ROLE_CHANGED: "role_changed",
  PROFILE_UPDATED: "profile_updated",
  STATS_CREATED: "stats_created",
  STATS_UPDATED: "stats_updated",
  ASSESSMENT_CREATED: "assessment_created",
  ASSESSMENT_UPDATED: "assessment_updated",
} as const;

export type ActivityAction =
  (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS];

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

// Hebrew labels for actions
export const ACTIVITY_ACTION_LABELS_HE: Record<ActivityAction, string> = {
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
};

// Hebrew labels for fields
export const FIELD_LABELS_HE: Record<string, string> = {
  full_name: "שם מלא",
  phone: "טלפון",
  birthdate: "תאריך לידה",
  role: "תפקיד",
  is_active: "סטטוס",
  position: "עמדה",
  avatar_url: "תמונת פרופיל",
};

// Hebrew labels for role values
export const ROLE_LABELS_HE: Record<string, string> = {
  trainee: "מתאמן",
  trainer: "מאמן",
  admin: "מנהל",
};
