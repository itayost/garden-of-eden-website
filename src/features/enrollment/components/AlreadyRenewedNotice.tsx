import { CalendarCheck } from "lucide-react";
import { ddmmyyyy } from "@/lib/plans/confirmation-copy";

interface AlreadyRenewedNoticeProps {
  /** ISO date: the last day already paid for. */
  until: string;
  onBuyAnyway: () => void;
}

/** Shown on a renewal link when the next Plan is already paid and waiting. Never blocks. */
export function AlreadyRenewedNotice({ until, onBuyAnyway }: AlreadyRenewedNoticeProps) {
  return (
    <section className="rounded-2xl border bg-white p-6 text-center">
      <CalendarCheck className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
      <h2 className="mt-3 text-xl font-bold">המסלול כבר חודש עד {ddmmyyyy(until)}</h2>
      <p className="mt-2 text-sm text-black/60 sm:text-base">
        המסלול הבא כבר שולם ומחכה בתור. אין צורך לשלם שוב.
      </p>
      <button
        type="button"
        onClick={onBuyAnyway}
        className="mt-5 text-sm underline underline-offset-2 text-black/70 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        לרכישת מסלול נוסף בכל זאת
      </button>
    </section>
  );
}
