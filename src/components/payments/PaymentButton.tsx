"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PaymentButtonProps {
  planName: string;
  amount: number;
  description: string;
  paymentType: "one_time" | "recurring";
  className?: string;
  variant?: "default" | "highlighted";
  children?: React.ReactNode;
}

export function PaymentButton({
  planName,
  amount,
  description,
  paymentType,
  className,
  variant = "default",
  children,
}: PaymentButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if user is logged in
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Store payment intent in sessionStorage for after login
        sessionStorage.setItem(
          "pendingPayment",
          JSON.stringify({
            planName,
            amount,
            description: `${planName} - ${description}`,
            paymentType,
          })
        );
        // Redirect to login - will go to dashboard after login
        router.push("/auth/login?redirect=/dashboard");
        return;
      }

      // Call payment API
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          description: `${planName} - ${description}`,
          paymentType,
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
      console.error("Payment error:", err);
      setError(err instanceof Error ? err.message : "שגיאה בתהליך התשלום");
    } finally {
      setIsLoading(false);
    }
  };

  const buttonClasses =
    variant === "highlighted"
      ? "bg-[#CDEA68] hover:bg-[#bdd85c] text-black"
      : "bg-black hover:bg-black/80 text-white";

  return (
    <div className="w-full">
      <Button
        onClick={handlePayment}
        disabled={isLoading}
        className={`w-full py-5 rounded-full font-medium transition-all duration-300 ${buttonClasses} ${className}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            מעבד...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 ml-2" />
            {children || "התחילו עכשיו"}
          </>
        )}
      </Button>
      {error && (
        <p className="text-red-500 text-xs mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
