"use client";

import type { Control, FieldValues, Path } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { TermsSheet } from "./TermsSheet";

/** The four fields every agreement form shares. */
export interface DeclarationValues extends FieldValues {
  declaresHealthy: boolean;
  acceptsTerms: boolean;
  authorizesPayment: boolean;
  photoConsent?: "yes" | "no";
}

function DeclarationField<T extends DeclarationValues>({
  control,
  name,
  disabled,
  children,
}: {
  control: Control<T>;
  name: "declaresHealthy" | "acceptsTerms" | "authorizesPayment";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <FormField
      control={control}
      name={name as Path<T>}
      render={({ field }) => (
        <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-xl border border-black/10 p-3 has-[button[data-state=checked]]:border-[#CDEA68] has-[button[data-state=checked]]:bg-[#CDEA68]/10">
          <FormControl>
            <Checkbox
              className="mt-0.5 size-5"
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              disabled={disabled}
            />
          </FormControl>
          <div className="space-y-1 leading-snug">
            <FormLabel required className="cursor-pointer font-normal">{children}</FormLabel>
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
}

/**
 * The declarations block of the הסכם התקשרות: health, terms and cancellation
 * policy, payment authorization, photo consent. Shared by the online
 * enrollment form and the later signing page so the wording is one.
 */
export function AgreementDeclarations<T extends DeclarationValues>({
  control,
  disabled,
}: {
  control: Control<T>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <DeclarationField control={control} name="declaresHealthy" disabled={disabled}>
        אני מצהיר/ה כי החניך/ה כשיר/ה מבחינה בריאותית להשתתף בפעילות גופנית, ואין מניעה רפואית ידועה מלבד המפורט לעיל.
      </DeclarationField>
      <DeclarationField control={control} name="acceptsTerms" disabled={disabled}>
        <span>
          אני מאשר/ת כי קראתי את <TermsSheet /> ואת{" "}
          <a href="/cancellation-policy" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            מדיניות ביטול העסקה
          </a>{" "}
          במלואם, הבנתי את תנאיהם, לרבות החזרים וחיוב, ואני מסכים/ה להם.
        </span>
      </DeclarationField>
      <DeclarationField control={control} name="authorizesPayment" disabled={disabled}>
        אני מסמיך/ה את גארדן אוף עדן לחייב את אמצעי התשלום שנמסר בהתאם למסלול שנבחר, כמפורט בתקנון.
      </DeclarationField>

      <FormField
        control={control}
        name={"photoConsent" as Path<T>}
        render={({ field }) => (
          <FormItem className="space-y-2">
            <FormLabel required className="font-normal">
              ידוע לי כי במהלך האימונים עשויים להיות צילומים לצורכי שיתוף ברשתות החברתיות של המועדון.
            </FormLabel>
            <div className="grid grid-cols-2 gap-3">
              {(["yes", "no"] as const).map((option) => (
                <div key={option} className="flex items-center gap-2 rounded-xl border border-black/10 p-3">
                  <Checkbox
                    className="size-5"
                    id={`photo-${option}`}
                    checked={field.value === option}
                    onCheckedChange={(checked) => field.onChange(checked === true ? option : undefined)}
                    disabled={disabled}
                  />
                  <Label htmlFor={`photo-${option}`} className="cursor-pointer">
                    {option === "yes" ? "מאשר/ת צילום" : "לא מעוניין/ת בצילום"}
                  </Label>
                </div>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
