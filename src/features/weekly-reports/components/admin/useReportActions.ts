"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Gender } from "@/lib/profile/gender";
import { approveReportAction } from "../../lib/actions/approve";
import { saveReportTextsAction } from "../../lib/actions/edit";
import { setReportGenderAction } from "../../lib/actions/gender";
import { holdReportAction } from "../../lib/actions/hold";
import { rewriteReportAction } from "../../lib/actions/rewrite";
import type { ActionResult } from "../../lib/actions/staff-report";
import type { ReportDetail } from "../../lib/queries/queue";

/**
 * The sheet's actions on one report. Each sends the version the screen shows,
 * so a report that changed meanwhile is refused instead of acted on; each
 * shows a toast and refreshes the page. An approval closes the sheet.
 */
export function useReportActions(report: Pick<ReportDetail, "id" | "version">, onDone: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const ids = { reportId: report.id, version: report.version };

  async function run(name: string, action: () => Promise<ActionResult>, message: (held: boolean) => string) {
    setBusy(name);
    try {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return false;
      }
      toast.success(message(result.held ?? false));
      if (name === "approve") onDone();
      else startRefresh(() => router.refresh());
      return true;
    } catch {
      toast.error("הפעולה נכשלה, נסו שוב");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return {
    busy,
    locked: busy !== null || refreshing,
    approve: () => run("approve", () => approveReportAction(ids), () => "הדוח אושר"),
    save: (playerText: string, parentText: string) =>
      run(
        "save",
        () => saveReportTextsAction({ ...ids, playerText, parentText }),
        (held) => (held ? "השינויים נשמרו. הדוח עדיין מעוכב" : "השינויים נשמרו"),
      ),
    hold: (reason: string) => run("hold", () => holdReportAction({ ...ids, reason }), () => "הדוח עוכב"),
    rewrite: () =>
      run("rewrite", () => rewriteReportAction(ids), (held) => (held ? "הדוח נכתב מחדש ומעוכב" : "הדוח נכתב מחדש")),
    setGender: (gender: Gender) =>
      run(
        `gender-${gender}`,
        () => setReportGenderAction({ ...ids, gender }),
        (held) => (held ? "המגדר נשמר. הדוח נכתב ומעוכב" : "המגדר נשמר והדוח נכתב"),
      ),
  };
}
