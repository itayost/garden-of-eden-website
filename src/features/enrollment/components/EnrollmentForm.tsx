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

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="border-s-4 border-[#CDEA68] ps-3 text-lg font-bold">{children}</h2>
  );
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
        <FormItem className="flex flex-row items-start gap-3 space-y-0">
          <FormControl>
            <Checkbox
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          </FormControl>
          <div className="space-y-1 leading-snug">
            <FormLabel className="font-normal">{children}</FormLabel>
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
      // On success the action redirects to Morning; nothing to do here.
    } catch {
      toast.error("שגיאה בשליחת הטופס. נסו שוב.");
      setLoading(false);
    }
  };

  const priceLabel = `₪${product.price_ils.toLocaleString("he-IL")}`;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-8">
        <section className="space-y-4">
          <SectionTitle>פרטי ההורה / האפוטרופוס</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="parentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם מלא</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={loading} />
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
                  <FormLabel>מספר ת.ז</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="numeric" dir="ltr" className="text-right" disabled={loading} />
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
                  <FormLabel>טלפון נייד (לתשלום ולקבלה)</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="tel" dir="ltr" className="text-right" placeholder="0501234567" disabled={loading} />
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
                  <FormLabel>טלפון וואטסאפ של החניך (להתחברות לאפליקציה)</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="tel" dir="ltr" className="text-right" placeholder="0521234567" disabled={loading} />
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
                    <Input {...field} value={field.value ?? ""} type="email" dir="ltr" className="text-right" disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>פרטי החניך/ה</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="childName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם מלא</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={loading} />
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
                  <FormLabel>תאריך לידה</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" max={today} disabled={loading} />
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
                    <Textarea {...field} value={field.value ?? ""} rows={2} disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>פרטי המסלול הנרכש</SectionTitle>
          <dl className="grid gap-2 rounded-2xl border bg-muted/30 p-4 text-sm sm:grid-cols-2">
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
        </section>

        <section className="space-y-4">
          <SectionTitle>איש קשר נוסף למקרה חירום</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="emergencyContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם מלא</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={loading} />
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
                  <FormLabel>טלפון</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="tel" dir="ltr" className="text-right" disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>הצהרות ואישורים</SectionTitle>
          <div className="space-y-4 rounded-2xl border p-4">
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
                  <FormLabel className="font-normal">
                    ידוע לי כי במהלך האימונים עשויים להיות צילומים לצורכי שיתוף ברשתות החברתיות של המועדון.
                  </FormLabel>
                  <div className="flex gap-6">
                    {(["yes", "no"] as const).map((option) => (
                      <div key={option} className="flex items-center gap-2">
                        <Checkbox
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
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border-2 border-[#CDEA68] bg-[#CDEA68]/10 p-4 text-sm font-medium">
            בחתימתי מטה אני מאשר/ת כי כל הפרטים שמסרתי נכונים, וכי אני מקבל/ת על עצמי את תנאי הסכם זה ואת תקנון גארדן אוף עדן במלואם.
          </div>
          <FormField
            control={form.control}
            name="signatureName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>שם ההורה כחתימה</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="הקלידו את שמכם המלא" disabled={loading} />
                </FormControl>
                <FormDescription>הקלדת השם מהווה חתימה דיגיטלית על ההסכם</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
          {loading ? "מעבירים לתשלום..." : `לתשלום ${priceLabel}`}
        </Button>
      </form>
    </Form>
  );
}
