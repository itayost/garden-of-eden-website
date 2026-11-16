import { israelToday } from "@/lib/utils/tasks";
import { loadPlayerReport } from "../../lib/queries/player";
import { MissedYouCard } from "./MissedYouCard";
import { WeeklyReportCard } from "./WeeklyReportCard";

interface WeeklyReportSectionProps {
  userId: string;
  canBook: boolean;
}

/**
 * The dashboard's Weekly report card, read on its own inside a Suspense of the
 * page so it never holds the rest of the dashboard back. Shows the current
 * Report week's sent report or "התגעגענו", and nothing otherwise.
 */
export async function WeeklyReportSection({ userId, canBook }: WeeklyReportSectionProps) {
  const report = await loadPlayerReport(userId, israelToday());
  if (!report) return null;
  if (report.kind === "missed_you") return <MissedYouCard firstName={report.firstName} canBook={canBook} />;
  return <WeeklyReportCard report={report} />;
}
