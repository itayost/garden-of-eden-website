"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";

export function PaymentStatusHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");

    if (paymentStatus === "success") {
      toast.success("התשלום בוצע בהצלחה!", {
        description: "תודה על ההרשמה! כעת יש לך גישה מלאה למערכת.",
        icon: <CheckCircle className="w-5 h-5 text-green-500" />,
        duration: 5000,
      });
      // Remove the query param from URL
      router.replace("/", { scroll: false });
    } else if (paymentStatus === "cancelled") {
      toast.error("התשלום בוטל", {
        description: "התשלום לא הושלם. תוכלו לנסות שוב בכל עת.",
        icon: <XCircle className="w-5 h-5 text-red-500" />,
        duration: 5000,
      });
      // Remove the query param from URL
      router.replace("/", { scroll: false });
    }
  }, [searchParams, router]);

  return null;
}
