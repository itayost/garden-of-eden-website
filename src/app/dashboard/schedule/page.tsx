import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyScheduleAction } from "@/features/booking/lib/actions/schedule";
import { PlanStrip } from "@/features/booking/components/PlanStrip";
import { ScheduleClient } from "@/features/booking/components/ScheduleClient";

export const metadata: Metadata = { title: "אימונים | Garden of Eden" };

export default async function TraineeSchedulePage() {
  const view = await getMyScheduleAction();
  if ("error" in view) redirect("/auth/login?redirect=/dashboard/schedule");
  if (!view.canBook) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">אימונים</h1>
        <p className="text-sm text-muted-foreground">הרשמה לאימונים בסניף קריית אתא, עד שבועיים קדימה.</p>
      </header>
      <PlanStrip plan={view.plan} block={view.block} />
      <ScheduleClient view={view} />
    </div>
  );
}
