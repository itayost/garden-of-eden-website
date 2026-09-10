"use client";

import { useState } from "react";
import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRequiredLegend,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { enrollmentSchema, type EnrollmentInput } from "@/lib/validations/enrollment";
import type { PlanProduct } from "@/types/plans";
import { TermsSheet } from "./TermsSheet";

interface EnrollmentFormProps {
  product: PlanProduct;
  prefill?: Partial<EnrollmentInput>;
  renewalToken?: string;
  onSubmit: (input: EnrollmentInput) => Promise<{ error?: string }>;
}

function SectionTitle({ step, children }: { step: number; children: string }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-bold">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#CDEA68] text-sm font-bold text-black">
        {step}
      </span>
      {children}
    </h2>
  );
}

/** A card per section: on a phone each one is a screen of its own. */
function Section({ children }: { children: React.ReactNode }) {
  return <section className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6">{children}</section>;
}

function DeclarationField({
  control,
  name,
  children,
}: {
  control: Control<EnrollmentInput>;
  name: "declaresHealthy" | "acceptsTerms" | "authorizesPayment";
  children: React.ReactNode;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-xl border border-black/10 p-3 has-[button[data-state=checked]]:border-[#CDEA68] has-[button[data-state=checked]]:bg-[#CDEA68]/10">
          <FormControl>
            <Checkbox
              className="mt-0.5 size-5"
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
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

function ddmmyyyy(iso: string): string {
  return iso.split("-").reverse().join("/");
}

export function EnrollmentForm({ product, prefill, renewalToken, onSubmit }: EnrollmentFormProps) {
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  // The schema transforms phones and the photo answer, so its output type
  // differs from the field values. raw: true makes the resolver validate with
  // the full schema but hand the untouched field values to onSubmit, which is
  // what the action re-parses. Without it the parsed output (null email,
  // boolean photo consent) fails the input schema on the server.
  const form = useForm<EnrollmentInput>({
    resolver: zodResolver(enrollmentSchema, undefined, { raw: true }),
    defaultValues: {
      productId: product.id,
      renewalToken,
      parentName: "",
      parentIdNumber: "",
      payerPhone: "",
      loginPhone: "",
      email: "",
      childName: "",
      childBirthdate: "",
      medicalNotes: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      declaresHealthy: false,
      acceptsTerms: false,
      authorizesPayment: false,
      photoConsent: undefined,
      signatureName: "",
      ...prefill,
    },
  });

  const submit = async (input: EnrollmentInput) => {
    setLoading(true);
    try {
      const result = await onSubmit(input);
      if (result.error) {
        toast.error(result.error);
        setLoading(false);
      }
      // On success the action redirects to the payment page; nothing to do here.
    } catch {
      toast.error("שגיאה בשליחת הטופס. נסו שוב.");
      setLoading(false);
    }
  };

  const priceLabel = `₪${product.price_ils.toLocaleString("he-IL")}`;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-8">
        <FormRequiredLegend />
        <Section>
          <SectionTitle step={1}>פרטי ההורה / האפוטרופוס</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="parentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>שם מלא</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="section-parent name" className="h-12 rounded-xl text-base" disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentIdNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>מספר ת.ז</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" inputMode="numeric" dir="ltr" className="h-12 rounded-xl text-base text-right" disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payerPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>טלפון נייד (לתשלום ולקבלה)</FormLabel>
                  <FormControl>
                    <Input {...field} type="tel" autoComplete="section-parent tel" inputMode="tel" dir="ltr" className="h-12 rounded-xl text-base text-right" placeholder="0501234567" disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="loginPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>טלפון וואטסאפ של החניך (להתחברות לאפליקציה)</FormLabel>
                  <FormControl>
                    <Input {...field} type="tel" autoComplete="section-child tel" inputMode="tel" dir="ltr" className="h-12 rounded-xl text-base text-right" placeholder="0521234567" disabled={loading} />
                  </FormControl>
                  <FormDescription>קוד ההתחברות נשלח למספר הזה בוואטסאפ</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>דוא&quot;ל (לקבלת החשבונית)</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="section-parent email" value={field.value ?? ""} type="email" dir="ltr" className="h-12 rounded-xl text-base text-right" disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        <Section>
          <SectionTitle step={2}>פרטי החניך/ה</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="childName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>שם מלא</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="section-child name" className="h-12 rounded-xl text-base" disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="childBirthdate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>תאריך לידה</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="section-child bday" className="h-12 rounded-xl text-base" type="date" max={today} disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="medicalNotes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>אלרגיות / מגבלות רפואיות ידועות (אם קיימות)</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} rows={2} className="rounded-xl text-base" disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        <Section>
          <SectionTitle step={3}>פרטי המסלול הנרכש</SectionTitle>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">סוג מסלול</dt>
              <dd className="font-medium">{product.name_he}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">עלות</dt>
              <dd className="font-medium">{priceLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">תאריך תחילה</dt>
              <dd className="font-medium">{ddmmyyyy(today)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">אמצעי תשלום</dt>
              <dd className="font-medium">כרטיס אשראי</dd>
            </div>
          </dl>
        </Section>

        <Section>
          <SectionTitle step={4}>איש קשר נוסף למקרה חירום</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="emergencyContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>שם מלא</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="section-emergency name" className="h-12 rounded-xl text-base" disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emergencyContactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>טלפון</FormLabel>
                  <FormControl>
                    <Input {...field} type="tel" autoComplete="section-emergency tel" inputMode="tel" dir="ltr" className="h-12 rounded-xl text-base text-right" disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        <Section>
          <SectionTitle step={5}>הצהרות ואישורים</SectionTitle>
          <div className="space-y-3">
            <DeclarationField control={form.control} name="declaresHealthy">
              אני מצהיר/ה כי החניך/ה כשיר/ה מבחינה בריאותית להשתתף בפעילות גופנית, ואין מניעה רפואית ידועה מלבד המפורט לעיל.
            </DeclarationField>
            <DeclarationField control={form.control} name="acceptsTerms">
              <span>
                אני מאשר/ת כי קראתי את <TermsSheet /> ואת{" "}
                <a href="/cancellation-policy" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  מדיניות ביטול העסקה
                </a>{" "}
                במלואם, הבנתי את תנאיהם, לרבות החזרים וחיוב, ואני מסכים/ה להם.
              </span>
            </DeclarationField>
            <DeclarationField control={form.control} name="authorizesPayment">
              אני מסמיך/ה את גארדן אוף עדן לחייב את אמצעי התשלום שנמסר בהתאם למסלול שנבחר, כמפורט בתקנון.
            </DeclarationField>

            <FormField
              control={form.control}
              name="photoConsent"
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
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true ? option : undefined)
                          }
                          disabled={loading}
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
        </Section>

        <Section>
          <SectionTitle step={6}>חתימה</SectionTitle>
          <div className="rounded-xl border-2 border-[#CDEA68] bg-[#CDEA68]/10 p-4 text-sm font-medium">
            בחתימתי מטה אני מאשר/ת כי כל הפרטים שמסרתי נכונים, וכי אני מקבל/ת על עצמי את תנאי הסכם זה ואת תקנון גארדן אוף עדן במלואם.
          </div>
          <FormField
            control={form.control}
            name="signatureName"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>שם ההורה כחתימה</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="section-parent name" className="h-12 rounded-xl text-base" placeholder="הקלידו את שמכם המלא" disabled={loading} />
                </FormControl>
                <FormDescription>הקלדת השם מהווה חתימה דיגיטלית על ההסכם</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        {/* Sticky on a phone so the price and the next step are always in reach. */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="shrink-0 sm:hidden">
              <span className="block text-[11px] text-black/50">{product.name_he}</span>
              <span className="text-lg font-bold">{priceLabel}</span>
            </div>
        <Button type="submit" size="lg" className="h-12 min-w-0 flex-1 rounded-full text-base" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
          {loading ? "מעבירים לתשלום..." : `המשך לתשלום ${priceLabel}`}
        </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
