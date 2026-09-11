"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, Clock, Loader2, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SheetDialogContent } from "@/components/ui/sheet-dialog";
import { cn } from "@/lib/utils";
import { hebrewWeekday } from "@/lib/utils/date";
import { shortDate } from "@/lib/utils/iso-date";
import { BOOKING_BLOCK_LABELS_HE } from "@/lib/schedule/booking-rules";
import { bookSlotAction, cancelBookingAction } from "../lib/actions/book";
import type { BookableSlotView, MyBooking, TraineeScheduleView } from "../lib/actions/schedule";

const WEEKDAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const weekdayShort = (iso: string) => WEEKDAY_SHORT[new Date(`${iso}T00:00:00Z`).getUTCDay()];

function costLine(view: TraineeScheduleView): string {
  const plan = view.plan;
  if (!plan) return "";
  if (plan.sessionsLeft !== null) {
    const left = Math.max(plan.sessionsLeft - 1, 0);
    return `ינוצל אימון אחד מהכרטיסייה, יישארו ${left}`;
  }
  if (plan.weeklyCap !== null) return `אימון ${plan.weekCount + 1} מתוך ${plan.weeklyCap} השבוע`;
  return "";
}

/** The trainee's schedule: bookings, a two-week strip, a day's slots, and the confirm sheets. */
export function ScheduleClient({ view }: { view: TraineeScheduleView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const firstOpenDay = useMemo(
    () => view.days.find((d) => d.slots.some((s) => !s.closed))?.date ?? view.today,
    [view],
  );
  const [selectedDate, setSelectedDate] = useState(firstOpenDay);
  const [toBook, setToBook] = useState<BookableSlotView | null>(null);
  const [toCancel, setToCancel] = useState<MyBooking | null>(null);

  const day = view.days.find((d) => d.date === selectedDate) ?? { date: selectedDate, slots: [] };
  const blockedByPlan = view.block !== null;

  const book = (slot: BookableSlotView) =>
    startTransition(async () => {
      const result = await bookSlotAction(slot.id);
      if ("error" in result) {
        toast.error(result.error);
        setToBook(null);
        router.refresh();
        return;
      }
      toast.success(
        result.sessionsLeft !== null ? `נרשמת. נותרו ${result.sessionsLeft} אימונים` : "נרשמת לאימון",
      );
      setToBook(null);
      router.refresh();
    });

  const cancel = (booking: MyBooking) =>
    startTransition(async () => {
      const result = await cancelBookingAction(booking.slotId);
      if ("error" in result) {
        toast.error(result.error);
        setToCancel(null);
        return;
      }
      toast.success(result.late ? "בוטל. האימון נחשב כמנוצל" : "ההרשמה בוטלה");
      setToCancel(null);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-lg font-bold">האימונים שלי</h2>
        {view.bookings.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            עדיין לא נרשמת לאימון. בחרו יום למטה.
          </p>
        ) : (
          <ul className="space-y-2">
            {view.bookings.map((b) => (
              <li key={b.slotId} className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-3">
                <div className="min-w-0 text-sm">
                  <div className="font-bold">
                    {hebrewWeekday(b.date)} {shortDate(b.date)} · {b.time}
                  </div>
                  <div className="text-muted-foreground">
                    {b.trainerName}
                    {b.location ? ` · ${b.location}` : ""}
                    {b.byStaff ? " · נקבע על ידי הצוות" : ""}
                  </div>
                </div>
                {!b.byStaff && b.cancelState !== "closed" && (
                  <Button variant="outline" size="sm" onClick={() => setToCancel(b)} disabled={pending}>
                    ביטול
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">הרשמה לאימון</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="ימים">
          {view.days.map((d) => {
            const open = d.slots.some((s) => !s.closed && s.seatsTaken < s.maxTrainees);
            const selected = d.date === selectedDate;
            return (
              <button
                key={d.date}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setSelectedDate(d.date)}
                className={cn(
                  "flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 text-sm transition-colors",
                  selected ? "border-forest bg-forest text-cream" : "border-border bg-white",
                  d.slots.length === 0 && !selected && "opacity-50",
                )}
              >
                <span className="text-xs">{weekdayShort(d.date)}</span>
                <span className="font-bold">{d.date.slice(8)}</span>
                <span className={cn("mt-1 h-1.5 w-1.5 rounded-full", open ? (selected ? "bg-cream" : "bg-forest") : "bg-transparent")} />
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {hebrewWeekday(day.date)} {shortDate(day.date)}
          </div>
          {day.slots.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">אין אימונים ביום הזה.</p>
          ) : (
            day.slots.map((slot) => {
              const full = slot.seatsTaken >= slot.maxTrainees;
              const left = slot.maxTrainees - slot.seatsTaken;
              const disabled = slot.booked || slot.closed || full || blockedByPlan;
              return (
                <div key={slot.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-3">
                  <div className="min-w-0 text-sm">
                    <div className="flex items-center gap-2 font-bold">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {slot.time}
                      {slot.label && <span className="font-normal text-muted-foreground">· {slot.label}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-muted-foreground">
                      <span>{slot.trainerName}</span>
                      {slot.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {slot.location}
                        </span>
                      )}
                      <span className={cn("flex items-center gap-1", full && "text-destructive")}>
                        <Users className="h-3 w-3" />
                        {full ? "מלא" : `נותרו ${left} מקומות`}
                      </span>
                    </div>
                  </div>
                  {slot.booked ? (
                    <span className="flex items-center gap-1 rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      רשום
                    </span>
                  ) : (
                    <Button size="sm" onClick={() => setToBook(slot)} disabled={disabled || pending}>
                      {slot.closed ? "נסגר" : full ? "מלא" : "הרשמה"}
                    </Button>
                  )}
                </div>
              );
            })
          )}
          {blockedByPlan && view.block && (
            <p className="text-xs text-muted-foreground">{BOOKING_BLOCK_LABELS_HE[view.block]}</p>
          )}
        </div>
      </section>

      <Dialog open={toBook !== null} onOpenChange={(v) => !v && setToBook(null)}>
        <SheetDialogContent>
          <DialogHeader className="px-4 pt-4 pb-3 text-start sm:px-6 sm:pt-6">
            <DialogTitle>להירשם לאימון?</DialogTitle>
            <DialogDescription>
              {toBook && `${hebrewWeekday(toBook.date)} ${shortDate(toBook.date)} בשעה ${toBook.time} עם ${toBook.trainerName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            {costLine(view) && <p className="rounded-xl bg-muted/40 p-3 text-sm">{costLine(view)}</p>}
            <p className="text-xs text-muted-foreground">אפשר לבטל עד 3 שעות לפני האימון. ביטול מאוחר יותר נחשב כאימון שנוצל.</p>
            <Button className="h-12 w-full rounded-full text-base" onClick={() => toBook && book(toBook)} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              אישור הרשמה
            </Button>
          </div>
        </SheetDialogContent>
      </Dialog>

      <Dialog open={toCancel !== null} onOpenChange={(v) => !v && setToCancel(null)}>
        <SheetDialogContent>
          <DialogHeader className="px-4 pt-4 pb-3 text-start sm:px-6 sm:pt-6">
            <DialogTitle>{toCancel?.cancelState === "late" ? "ביטול מאוחר" : "לבטל את ההרשמה?"}</DialogTitle>
            <DialogDescription>
              {toCancel && `${hebrewWeekday(toCancel.date)} ${shortDate(toCancel.date)} בשעה ${toCancel.time}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            {toCancel?.cancelState === "late" && (
              <p className="rounded-xl bg-destructive/5 p-3 text-sm text-destructive">
                נשארו פחות מ-3 שעות לאימון. הביטול יירשם, אבל האימון ייחשב כמנוצל.
              </p>
            )}
            <Button
              variant={toCancel?.cancelState === "late" ? "destructive" : "default"}
              className="h-12 w-full rounded-full text-base"
              onClick={() => toCancel && cancel(toCancel)}
              disabled={pending}
            >
              {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              {toCancel?.cancelState === "late" ? "כן, לבטל בכל זאת" : "ביטול ההרשמה"}
            </Button>
          </div>
        </SheetDialogContent>
      </Dialog>
    </div>
  );
}
