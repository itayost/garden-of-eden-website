import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { israelToday } from "@/lib/utils/tasks";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { requireSurveyStaff } from "@/features/surveys/lib/actions/staff-access";
import { newDraft } from "@/features/surveys/lib/draft";
import { canEditSurvey, choosableBranches } from "@/features/surveys/lib/permissions";
import { SurveyBuilder } from "@/features/surveys/components/admin/SurveyBuilder";

export const metadata: Metadata = { title: "סקר חדש | Garden of Eden" };

export default async function NewSurveyPage() {
  // Admins and Branch managers; anyone else has no business here.
  const access = await requireSurveyStaff();
  if ("error" in access) redirect("/admin");
  const { viewer } = access;

  // A Branch manager can only send a Survey to branches they manage; the save
  // action refuses any other, this keeps the picker to what will be accepted.
  const branches = choosableBranches(
    viewer.role,
    viewer.managedBranchIds,
    await listActiveBranchOptionsAction(),
  );
  const mayWrite = canEditSurvey(
    viewer.role,
    viewer.managedBranchIds,
    branches.map((branch) => branch.id),
  );
  if (!mayWrite) redirect("/admin/surveys");

  const today = israelToday();
  return (
    <SurveyBuilder
      surveyId={null}
      initial={newDraft(today)}
      state="draft"
      branches={branches}
      today={today}
    />
  );
}
