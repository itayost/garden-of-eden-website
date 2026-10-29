import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { isValidUUID } from "@/lib/validations/common";
import {
  listActiveBranchOptionsAction,
  listBranchesAction,
} from "@/features/branches/lib/actions/list-branches";
import { requireSurveyStaff } from "@/features/surveys/lib/actions/staff-access";
import { toDraft } from "@/features/surveys/lib/draft-mapping";
import { canEditSurvey, choosableBranches } from "@/features/surveys/lib/permissions";
import { loadSurvey, type LoadedSurvey } from "@/features/surveys/lib/queries";
import { surveyState } from "@/features/surveys/lib/state";
import type { SurveyViewer } from "@/features/surveys/lib/types";
import { LockedSurveyEditor } from "@/features/surveys/components/admin/LockedSurveyEditor";
import { SurveyBuilder } from "@/features/surveys/components/admin/SurveyBuilder";

export const metadata: Metadata = { title: "עריכת סקר | Garden of Eden" };

interface PageProps {
  params: Promise<{ surveyId: string }>;
}

/** A Survey somebody answered: its Questions and audience are shown, locked. */
async function lockedEditor(survey: LoadedSurvey, today: string) {
  const names = new Map((await listBranchesAction()).map((branch) => [branch.id, branch.name_he]));
  return (
    <LockedSurveyEditor
      record={survey.record}
      questions={survey.questions}
      responseCount={survey.responseCount}
      branchNames={survey.record.branchIds.flatMap((id) => names.get(id) ?? [])}
      today={today}
    />
  );
}

/** A Survey nobody answered yet: the full builder, with only the branches the viewer may choose. */
async function builder(survey: LoadedSurvey, viewer: SurveyViewer, today: string) {
  const { record, questions } = survey;
  const branches = choosableBranches(
    viewer.role,
    viewer.managedBranchIds,
    await listActiveBranchOptionsAction(),
  );
  // What the picker shows is what a save will keep: a branch that is no longer
  // active has no box to untick, so it is not carried along unseen.
  const initial = toDraft(record, questions);
  const shown = new Set(branches.map((branch) => branch.id));
  return (
    <SurveyBuilder
      surveyId={record.id}
      initial={{ ...initial, branchIds: initial.branchIds.filter((id) => shown.has(id)) }}
      state={surveyState(record, today)}
      branches={branches}
      today={today}
    />
  );
}

export default async function EditSurveyPage({ params }: PageProps) {
  const access = await requireSurveyStaff();
  if ("error" in access) redirect("/admin");
  const { viewer } = access;

  const { surveyId } = await params;
  if (!isValidUUID(surveyId)) notFound();

  // A failed read throws on purpose: the admin error page, not a blank editor.
  const survey = await loadSurvey(createAdminClient(), surveyId);
  if (survey === null) notFound();
  const { record } = survey;

  if (!canEditSurvey(viewer.role, viewer.managedBranchIds, record.branchIds)) {
    redirect("/admin/surveys");
  }
  // A Survey closed early takes no more changes of any kind; its page is the results.
  if (record.closedAt !== null) redirect(`/admin/surveys/${record.id}`);

  const today = israelToday();
  return survey.responseCount > 0 ? lockedEditor(survey, today) : builder(survey, viewer, today);
}
