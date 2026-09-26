import { redirect } from "next/navigation";

import { CALENDAR_TEMPLATE_PATH } from "@/lib/navigation/calendar-views";
import { isValidUUID } from "@/lib/validations/common";

interface PageProps {
  searchParams: Promise<{ branch?: string }>;
}

/** The weekly template moved into the calendar; old links and bookmarks land there. */
export default async function WeeklyScheduleRedirect({ searchParams }: PageProps) {
  const { branch } = await searchParams;
  const query = branch && isValidUUID(branch) ? `?branch=${branch}` : "";
  redirect(`${CALENDAR_TEMPLATE_PATH}${query}`);
}
