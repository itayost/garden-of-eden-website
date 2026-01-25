"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import { PaymentFormModal } from "./PaymentFormModal";

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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const buttonClasses =
    variant === "highlighted"
      ? "bg-[#CDEA68] hover:bg-[#bdd85c] text-black"
      : "bg-black hover:bg-black/80 text-white";

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        className={`w-full py-5 rounded-full font-medium transition-all duration-300 ${buttonClasses} ${className}`}
      >
        <CreditCard className="w-4 h-4 ml-2" />
        {children || "התחילו עכשיו"}
      </Button>

      <PaymentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        planName={planName}
        amount={amount}
        description={description}
        paymentType={paymentType}
      />
    </>
  );
}
