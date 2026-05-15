import { Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/date";
import type { NutritionMeasurementRow } from "../types";
import { MEASUREMENT_UNITS } from "../types";

interface TraineeMeasurementsHistoryProps {
  measurements: NutritionMeasurementRow[];
}

function formatNumber(value: number | null, decimals: number, unit?: string): string {
  if (value === null || value === undefined) return "—";
  const text = value.toFixed(decimals);
  return unit ? `${text} ${unit}` : text;
}

export function TraineeMeasurementsHistory({
  measurements,
}: TraineeMeasurementsHistoryProps) {
  if (measurements.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            מדדים
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          התזונאי טרם רשם מדדים עבורך
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          מדדים
        </CardTitle>
        <CardDescription>היסטוריית המדדים שלך לאורך הזמן</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead>גיל</TableHead>
                <TableHead>גובה</TableHead>
                <TableHead>אחוזון גובה</TableHead>
                <TableHead>משקל</TableHead>
                <TableHead>BMI</TableHead>
                <TableHead>אחוזון BMI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {measurements.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDateShort(row.measurement_date)}</TableCell>
                  <TableCell>{row.age ?? "—"}</TableCell>
                  <TableCell>
                    {formatNumber(row.height_cm, 1, MEASUREMENT_UNITS.height_cm)}
                  </TableCell>
                  <TableCell>
                    {formatNumber(
                      row.height_percentile,
                      2,
                      MEASUREMENT_UNITS.height_percentile
                    )}
                  </TableCell>
                  <TableCell>
                    {formatNumber(row.weight_kg, 2, MEASUREMENT_UNITS.weight_kg)}
                  </TableCell>
                  <TableCell>{formatNumber(row.bmi, 2)}</TableCell>
                  <TableCell>
                    {formatNumber(
                      row.bmi_percentile,
                      2,
                      MEASUREMENT_UNITS.bmi_percentile
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
