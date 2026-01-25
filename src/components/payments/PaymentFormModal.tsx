"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface PaymentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  amount: number;
  description: string;
  paymentType: "one_time" | "recurring";
}

export function PaymentFormModal({
  isOpen,
  onClose,
  planName,
  amount,
  description,
  paymentType,
}: PaymentFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate phone format (Israeli: starts with 05, 10 digits)
    const phoneRegex = /^05\d{8}$/;
    if (!phoneRegex.test(formData.phone)) {
      setError("מספר טלפון לא תקין (צריך להתחיל ב-05 ולהכיל 10 ספרות)");
      setIsLoading(false);
      return;
    }

    // Validate name (at least 2 words with 2+ chars each)
    const nameParts = formData.fullName.trim().split(/\s+/);
    if (nameParts.length < 2 || nameParts.some((part) => part.length < 2)) {
      setError("יש להזין שם מלא (שם פרטי ושם משפחה)");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          description: `${planName} - ${description}`,
          paymentType,
          payerName: formData.fullName.trim(),
          payerPhone: formData.phone,
          payerEmail: formData.email || undefined,
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
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">פרטים לתשלום</DialogTitle>
          <DialogDescription className="text-right">
            {planName} - ₪{amount.toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">שם מלא *</Label>
            <Input
              id="fullName"
              placeholder="ישראל ישראלי"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">טלפון *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="0501234567"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })
              }
              required
              disabled={isLoading}
              maxLength={10}
              dir="ltr"
              className="text-left"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">אימייל (לא חובה)</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              disabled={isLoading}
              dir="ltr"
              className="text-left"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-[#CDEA68] hover:bg-[#bdd85c] text-black"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  מעבד...
                </>
              ) : (
                "המשך לתשלום"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
