import { Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserRole } from "@/types/database";
import { getTraineeMeasurements } from "@/features/nutrition/lib/actions/get-trainee-measurements";
import { MeasurementsTable } from "./MeasurementsTable";

interface MeasurementsCardProps {
  userId: string;
  dateOfBirth: string | null;
  currentUserRole: UserRole;
}

export async function MeasurementsCard({
  userId,
  dateOfBirth,
  currentUserRole,
}: MeasurementsCardProps) {
  const measurements = await getTraineeMeasurements(userId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          מדדים
        </CardTitle>
        <CardDescription>
          רישום מדדים גופניים על פני זמן (גובה, משקל, BMI, אחוזון שומן)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MeasurementsTable
          userId={userId}
          measurements={measurements}
          dateOfBirth={dateOfBirth}
          currentUserRole={currentUserRole}
        />
      </CardContent>
    </Card>
  );
}
