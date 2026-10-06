import { createAdminClient } from "@/lib/supabase/admin";
import { loadStaffOptions } from "@/lib/staff-options";
import { PostWorkoutForm } from "./PostWorkoutForm";

/**
 * The post-training report. The trainer list is every active trainer and
 * admin, read here with the service role (trainees may not read admin
 * profiles under RLS): only names and ids reach the browser, and there is no
 * endpoint to call. The middleware has already checked the trainee.
 */
export default async function PostWorkoutFormPage() {
  const trainers = (await loadStaffOptions(createAdminClient())) ?? [];
  return <PostWorkoutForm trainers={trainers} />;
}
