import { Badge } from "@/components/ui/badge";
import {
  isAgeGroupOverrideActive,
  resolveAgeGroup,
  type AgeGroupProfile,
} from "@/lib/age-group-override";

interface AgeGroupBadgeProps {
  profile: AgeGroupProfile;
  className?: string;
}

/** YYYY-MM-DD as DD.MM.YYYY. */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

/** The trainee's age group, marked "ידני" while a staff-set group applies. */
export function AgeGroupBadge({ profile, className }: AgeGroupBadgeProps) {
  const group = resolveAgeGroup(profile);
  if (!group) return null;

  const isManual = isAgeGroupOverrideActive(profile);
  return (
    <Badge
      variant="outline"
      className={className}
      title={isManual ? `נקבע ידנית עד ${formatDate(profile.age_group_override_until!)}` : undefined}
    >
      {group.label}
      {isManual && <span className="ms-1 text-muted-foreground">ידני</span>}
    </Badge>
  );
}
