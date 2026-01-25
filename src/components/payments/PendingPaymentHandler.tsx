"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface PendingPayment {
  planName: string;
  amount: number;
  description: string;
  paymentType: "one_time" | "recurring";
}

export function PendingPaymentHandler() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processPendingPayment = async () => {
      const pendingPaymentStr = sessionStorage.getItem("pendingPayment");
      if (!pendingPaymentStr) return;

      // Remove immediately to prevent double processing
      sessionStorage.removeItem("pendingPayment");

      setIsProcessing(true);

      try {
        const pendingPayment: PendingPayment = JSON.parse(pendingPaymentStr);

        // Call payment API
        const response = await fetch("/api/payments/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: pendingPayment.amount,
            description: pendingPayment.description,
            paymentType: pendingPayment.paymentType,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "שגיאה ביצירת התשלום");
        }

        // Redirect to GROW payment page
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
        } else {
          throw new Error("לא התקבל קישור לתשלום");
        }
      } catch (err) {
        console.error("Pending payment error:", err);
        setError(err instanceof Error ? err.message : "שגיאה בתהליך התשלום");
        setIsProcessing(false);
      }
    };

    processPendingPayment();
  }, []);

  if (!isProcessing && !error) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-sm mx-4 text-center shadow-xl">
        {isProcessing ? (
          <>
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-[#CDEA68]" />
            <h3 className="text-lg font-semibold mb-2">ממשיכים לתשלום...</h3>
            <p className="text-gray-600 text-sm">אנחנו מעבירים אותך לדף התשלום</p>
          </>
        ) : error ? (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 text-2xl">!</span>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-red-600">שגיאה</h3>
            <p className="text-gray-600 text-sm mb-4">{error}</p>
            <button
              onClick={() => setError(null)}
              className="px-4 py-2 bg-black text-white rounded-full text-sm hover:bg-black/80"
            >
              סגור
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
