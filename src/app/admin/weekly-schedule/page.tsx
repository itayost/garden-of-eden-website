import { redirect } from "next/navigation";

import { isValidUUID } from "@/lib/validations/common";

interface PageProps {
  searchParams: Promise<{ branch?: string }>;
}

/** The weekly template moved into the calendar; old links and bookmarks land there. */
export default async function WeeklyScheduleRedirect({ searchParams }: PageProps) {
  const { branch } = await searchParams;
  const query = branch && isValidUUID(branch) ? `?branch=${branch}` : "";
  redirect(`/admin/calendar/template${query}`);
}
