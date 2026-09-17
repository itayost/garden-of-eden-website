"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { toLocalPhone } from "@/lib/plans/local-phone";
import { signAgreementSchema, type SignAgreementInput } from "@/lib/validations/agreement-sign";
import type { EnrollmentAgreement } from "@/types/plans";
import { signAgreementAction } from "../lib/actions/sign-agreement";
import { AgreementDeclarations } from "./AgreementDeclarations";

const ddmmyyyy = (iso: string) => iso.split("-").reverse().join("/");
const field = "h-12 rounded-xl text-base";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The parent's half of a staff-opened agreement: what the staff could not
 * know, the declarations, and the signature. Phone-first like the online
 * form; the page turns into the printable copy once signed.
 */
export function AgreementSignForm({ agreement, token }: { agreement: EnrollmentAgreement; token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const form = useForm<SignAgreementInput>({
    resolver: zodResolver(signAgreementSchema, undefined, { raw: true }),
    defaultValues: {
      agreementId: agreement.id,
      token,
      parentName: agreement.parent_name === "הורה" ? "" : agreement.parent_name,
      parentIdNumber: "",
      parentEmail: agreement.parent_email ?? "",
      childBirthdate: agreement.child_birthdate ?? "",
      medicalNotes: agreement.medical_notes ?? "",
      emergencyContactName: agreement.emergency_contact_name ?? "",
      emergencyContactPhone: toLocalPhone(agreement.emergency_contact_phone),
      declaresHealthy: false,
      acceptsTerms: false,
      authorizesPayment: false,
      photoConsent: undefined,
      signatureName: "",
    },
  });

  const submit = async (input: SignAgreementInput) => {
    setLoading(true);
    try {
      const result = await signAgreementAction(input);
      if ("error" in result) {
        toast.error(result.error);
        setLoading(false);
        return;
      }
      toast.success("תודה, ההסכם נחתם");
      router.refresh();
    } catch {
      toast.error("שגיאה בשליחה. נסו שוב.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-black/60">סניף קריית אתא</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">חתימה על הסכם ההרשמה</h1>
        <p className="mt-2 text-sm text-black/60">
          התשלום התקבל. נשארו כמה פרטים שרק אתם יכולים למלא, ההצהרות והחתימה.
        </p>
      </header>

      <section className="rounded-2xl border bg-white p-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-black/60">חניך/ה</dt>
          <dd className="font-medium">{agreement.child_name}</dd>
          <dt className="text-black/60">מסלול</dt>
          <dd className="font-medium">{agreement.plan_name}</dd>
          <dt className="text-black/60">מחיר</dt>
          <dd className="font-medium">₪{Number(agreement.plan_price_ils).toLocaleString("he-IL")}</dd>
          <dt className="text-black/60">תחילה</dt>
          <dd className="font-medium">{ddmmyyyy(agreement.plan_start_on)}</dd>
          <dt className="text-black/60">שולם ב</dt>
          <dd className="font-medium">{agreement.payment_method}</dd>
        </dl>
      </section>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
          <FormRequiredLegend />
          <Section title="פרטי ההורה / האפוטרופוס">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="parentName" render={({ field: f }) => (
                <FormItem><FormLabel required>שם מלא</FormLabel><FormControl><Input {...f} className={field} autoComplete="section-parent name" disabled={loading} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="parentIdNumber" render={({ field: f }) => (
                <FormItem><FormLabel required>מספר ת.ז</FormLabel><FormControl><Input {...f} className={`${field} text-right`} inputMode="numeric" dir="ltr" autoComplete="off" disabled={loading} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="parentEmail" render={({ field: f }) => (
                <FormItem className="sm:col-span-2"><FormLabel>דוא&quot;ל (לקבלת החשבונית)</FormLabel><FormControl><Input {...f} value={f.value ?? ""} type="email" className={`${field} text-right`} dir="ltr" autoComplete="section-parent email" disabled={loading} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
          </Section>

          <Section title="פרטי החניך/ה">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="childBirthdate" render={({ field: f }) => (
                <FormItem><FormLabel required>תאריך לידה</FormLabel><FormControl><Input {...f} type="date" max={today} className={field} autoComplete="section-child bday" disabled={loading} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="medicalNotes" render={({ field: f }) => (
                <FormItem className="sm:col-span-2"><FormLabel>אלרגיות / מגבלות רפואיות ידועות (אם קיימות)</FormLabel><FormControl><Textarea {...f} value={f.value ?? ""} rows={2} className="rounded-xl text-base" disabled={loading} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
          </Section>

          <Section title="איש קשר נוסף למקרה חירום">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="emergencyContactName" render={({ field: f }) => (
                <FormItem><FormLabel required>שם מלא</FormLabel><FormControl><Input {...f} className={field} autoComplete="section-emergency name" disabled={loading} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="emergencyContactPhone" render={({ field: f }) => (
                <FormItem><FormLabel required>טלפון</FormLabel><FormControl><Input {...f} type="tel" inputMode="tel" className={`${field} text-right`} dir="ltr" autoComplete="section-emergency tel" disabled={loading} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
          </Section>

          <Section title="הצהרות ואישורים">
            <AgreementDeclarations control={form.control} disabled={loading} />
          </Section>

          <Section title="חתימה">
            <div className="rounded-xl border-2 border-brand-lime bg-brand-lime/10 p-4 text-sm font-medium">
              בחתימתי מטה אני מאשר/ת כי כל הפרטים שמסרתי נכונים, וכי אני מקבל/ת על עצמי את תנאי הסכם זה ואת תקנון גארדן אוף עדן במלואם.
            </div>
            <FormField control={form.control} name="signatureName" render={({ field: f }) => (
              <FormItem><FormLabel required>שם ההורה כחתימה</FormLabel><FormControl><Input {...f} className={field} placeholder="הקלידו את שמכם המלא" autoComplete="section-parent name" disabled={loading} /></FormControl><FormDescription>הקלדת השם מהווה חתימה דיגיטלית על ההסכם</FormDescription><FormMessage /></FormItem>
            )} />
          </Section>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
            <div className="mx-auto max-w-2xl">
              <Button type="submit" size="lg" className="h-12 w-full rounded-full text-base" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <PenLine className="h-4 w-4 me-2" />}
                חתימה על ההסכם
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
