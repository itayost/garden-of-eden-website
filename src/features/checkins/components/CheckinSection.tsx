import { israelToday } from "@/lib/utils/tasks";
import { loadTodayCheckin } from "../lib/queries";
import { CheckinCard } from "./CheckinCard";

/** The dashboard's Check-in card, read on its own inside a Suspense of the page. */
export async function CheckinSection({ userId }: { userId: string }) {
  const today = israelToday();
  const { isTrainee, today: saved } = await loadTodayCheckin(userId, today);
  if (!isTrainee) return null;
  // Keyed by the saved answer so a refresh after saving starts from it.
  const key = saved ? `${saved.date}-${saved.sleepHours}-${saved.energy}-${saved.soreness}` : "new";
  return <CheckinCard key={key} today={today} saved={saved} />;
}
