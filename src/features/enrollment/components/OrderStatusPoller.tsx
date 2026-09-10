"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { getOrderStatusAction } from "../lib/actions/order-status";

const POLL_MS = 3_000;
const MAX_POLLS = 20;

type View = "waiting" | "confirmed" | "timeout";

export function OrderStatusPoller({ orderId }: { orderId: string }) {
  const [view, setView] = useState<View>("waiting");

  useEffect(() => {
    let polls = 0;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      polls += 1;
      const result = await getOrderStatusAction(orderId);
      if (cancelled) return;
      if ("status" in result && result.status === "paid") {
        setView("confirmed");
        return;
      }
      // Failed or expired will not turn into paid by waiting.
      if ("status" in result && result.status !== "pending") {
        setView("timeout");
        return;
      }
      if (polls >= MAX_POLLS) {
        setView("timeout");
        return;
      }
      setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (view === "confirmed") {
    return (
      <div className="space-y-2 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="text-2xl font-bold">התשלום התקבל</h1>
        <p className="text-black/60">
          קוד ההתחברות לאפליקציה יגיע בוואטסאפ למספר של החניך, והחשבונית למייל.
        </p>
      </div>
    );
  }

  if (view === "timeout") {
    return (
      <div className="space-y-2 text-center">
        <Clock className="mx-auto h-12 w-12 text-black/40" />
        <h1 className="text-2xl font-bold">התשלום בטיפול</h1>
        <p className="text-black/60">אישור התשלום יגיע בוואטסאפ בדקות הקרובות.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-center">
      <Loader2 className="mx-auto h-12 w-12 animate-spin text-black/40" />
      <h1 className="text-2xl font-bold">ממתינים לאישור התשלום</h1>
      <p className="text-black/60">זה לוקח כמה שניות.</p>
    </div>
  );
}
