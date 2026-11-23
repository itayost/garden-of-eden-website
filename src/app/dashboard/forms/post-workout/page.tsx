import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadStaffOptions } from "@/lib/staff-options";
import { PostWorkoutForm } from "./PostWorkoutForm";
import { getCurrentUser } from "@/lib/supabase/current-user";

/**
 * The post-training report. The trainer list is every active trainer and
 * admin, read here with the service role (trainees may not read staff
 * profiles under RLS): only names and ids reach the browser, and there is no
 * endpoint to call. The page checks the user itself before that read, since
 * a layout renders in parallel and does not guard a page's data.
 */
export default async function PostWorkoutFormPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?redirect=/dashboard/forms/post-workout");
  const trainers = (await loadStaffOptions(createAdminClient())) ?? [];
  return <PostWorkoutForm trainers={trainers} />;
}
