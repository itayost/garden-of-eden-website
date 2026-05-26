export type LeadTabColor =
  | "gray"
  | "blue"
  | "green"
  | "orange"
  | "purple"
  | "red"
  | "pink"
  | "yellow";

export const LEAD_TAB_COLORS: readonly LeadTabColor[] = [
  "gray",
  "blue",
  "green",
  "orange",
  "purple",
  "red",
  "pink",
  "yellow",
] as const;

export const LEAD_TAB_COLOR_LABELS: Record<LeadTabColor, string> = {
  gray: "אפור",
  blue: "כחול",
  green: "ירוק",
  orange: "כתום",
  purple: "סגול",
  red: "אדום",
  pink: "ורוד",
  yellow: "צהוב",
};

export const LEAD_TAB_COLOR_CLASSES: Record<LeadTabColor, string> = {
  gray:   "bg-gray-100 text-gray-800",
  blue:   "bg-blue-100 text-blue-800",
  green:  "bg-green-100 text-green-800",
  orange: "bg-orange-100 text-orange-800",
  purple: "bg-purple-100 text-purple-800",
  red:    "bg-red-100 text-red-800",
  pink:   "bg-pink-100 text-pink-800",
  yellow: "bg-yellow-100 text-yellow-800",
};

export interface LeadTab {
  id: string;
  slug: string;
  name: string;
  color: LeadTabColor | null;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function toLeadTabColor(value: string | null): LeadTabColor | null {
  if (!value) return null;
  return (LEAD_TAB_COLORS as readonly string[]).includes(value)
    ? (value as LeadTabColor)
    : null;
}
