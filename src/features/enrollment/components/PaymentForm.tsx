"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { detectBrand, formatCardNumber } from "@/lib/payments/card";
import {
  cardPaymentSchema,
  MAX_INSTALLMENTS,
  type CardPaymentInput,
} from "@/lib/validations/card-payment";
import { chargeOrderAction } from "../lib/actions/charge-order";

interface PaymentFormProps {
  orderId: string;
  amountIls: number;
}

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  diners: "Diners",
  isracard: "Isracard",
};

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 12 }, (_, i) => THIS_YEAR + i);

const field = "h-12 rounded-xl text-base";
const select =
  "h-12 w-full rounded-xl border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * The card form. Values stay in component state and the action's arguments:
 * nothing here writes to storage, and the number is masked to its brand for
 * the on-screen hint only.
 */
export function PaymentForm({ orderId, amountIls }: PaymentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const form = useForm<CardPaymentInput>({
    resolver: zodResolver(cardPaymentSchema, undefined, { raw: true }),
    defaultValues: {
      orderId,
      holderName: "",
      holderId: "",
      cardNumber: "",
      expMonth: "" as unknown as number,
      expYear: "" as unknown as number,
      cvv: "",
      installments: 1,
    },
  });

  const cardNumber = useWatch({ control: form.control, name: "cardNumber" });
  const brand = detectBrand(cardNumber ?? "");
  const priceLabel = `₪${amountIls.toLocaleString("he-IL")}`;

  const submit = async (input: CardPaymentInput) => {
    setLoading(true);
    try {
      const result = await chargeOrderAction(input);
      if ("error" in result) {
        toast.error(result.error);
        setLoading(false);
        return;
      }
      router.push(`/join/success?order=${orderId}`);
    } catch {
      toast.error("שגיאה בביצוע התשלום. נסו שוב.");
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5" autoComplete="on">
        <FormField
          control={form.control}
          name="holderName"
          render={({ field: f }) => (
            <FormItem>
              <FormLabel>שם בעל הכרטיס</FormLabel>
              <FormControl>
                <Input {...f} className={field} autoComplete="cc-name" disabled={loading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="holderId"
          render={({ field: f }) => (
            <FormItem>
              <FormLabel>ת.ז של בעל הכרטיס</FormLabel>
              <FormControl>
                <Input {...f} className={`${field} text-right`} inputMode="numeric" dir="ltr" disabled={loading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cardNumber"
          render={({ field: f }) => (
            <FormItem>
              <FormLabel className="flex items-center justify-between">
                <span>מספר כרטיס</span>
                {BRAND_LABEL[brand] && (
                  <span className="text-xs font-normal text-black/50">{BRAND_LABEL[brand]}</span>
                )}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <CreditCard className="pointer-events-none absolute end-3 top-1/2 h-5 w-5 -translate-y-1/2 text-black/30" />
                  <Input
                    {...f}
                    value={formatCardNumber(f.value ?? "")}
                    onChange={(e) => f.onChange(formatCardNumber(e.target.value))}
                    className={`${field} pe-11 text-right tracking-widest`}
                    inputMode="numeric"
                    dir="ltr"
                    autoComplete="cc-number"
                    placeholder="0000 0000 0000 0000"
                    disabled={loading}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-3 gap-3">
          <FormField
            control={form.control}
            name="expMonth"
            render={({ field: f }) => (
              <FormItem>
                <FormLabel>חודש</FormLabel>
                <FormControl>
                  <select {...f} value={String(f.value ?? "")} className={select} autoComplete="cc-exp-month" disabled={loading}>
                    <option value="">MM</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={Number(m)}>{m}</option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="expYear"
            render={({ field: f }) => (
              <FormItem>
                <FormLabel>שנה</FormLabel>
                <FormControl>
                  <select {...f} value={String(f.value ?? "")} className={select} autoComplete="cc-exp-year" disabled={loading}>
                    <option value="">YYYY</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cvv"
            render={({ field: f }) => (
              <FormItem>
                <FormLabel>CVV</FormLabel>
                <FormControl>
                  <Input
                    {...f}
                    className={`${field} text-center`}
                    inputMode="numeric"
                    dir="ltr"
                    autoComplete="cc-csc"
                    maxLength={4}
                    placeholder="123"
                    disabled={loading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {MAX_INSTALLMENTS > 1 && (
          <FormField
            control={form.control}
            name="installments"
            render={({ field: f }) => (
              <FormItem>
                <FormLabel>תשלומים</FormLabel>
                <FormControl>
                  <select {...f} value={String(f.value ?? 1)} className={select} disabled={loading}>
                    {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? "תשלום אחד" : `${n} תשלומים של ₪${Math.ceil(amountIls / n).toLocaleString("he-IL")}`}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <p className="flex items-start gap-2 text-xs text-black/50">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          הפרטים מועברים מוצפנים ישירות לחברת הסליקה ואינם נשמרים באתר. החיוב מופיע כ&quot;גארדן אוף עדן&quot;.
        </p>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <Button type="submit" size="lg" className="h-12 min-w-0 flex-1 rounded-full text-base" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Lock className="h-4 w-4 me-2" />}
              {loading ? "מחייבים..." : `תשלום מאובטח ${priceLabel}`}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
