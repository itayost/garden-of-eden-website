import type { EnrollmentAgreement } from "@/types/plans";
import { formatPhoneToLocal } from "@/lib/validations/common";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border-b border-dashed pb-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="min-h-6 font-medium">{value || ""}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="border-s-4 border-brand-lime ps-3 text-lg font-bold">{title}</h2>
      <div className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const ddmmyyyy = (iso: string) => iso.split("-").reverse().join("/");

/** The link travels over WhatsApp; the full number stays in the database. */
const maskIdNumber = (id: string) =>
  id.length > 3 ? `${"*".repeat(id.length - 3)}${id.slice(-3)}` : id;

export function AgreementPrintable({ agreement }: { agreement: EnrollmentAgreement }) {
  return (
    <article className="mx-auto max-w-3xl space-y-8 rounded-3xl border bg-white p-6 print:border-0 sm:p-10">
      <header className="text-center">
        <h1 className="text-2xl font-bold">הסכם התקשרות והרשמה</h1>
        <p className="text-sm text-muted-foreground">
          Garden Of Eden. טופס להשלמה על ידי ההורה / האפוטרופוס
        </p>
      </header>

      <Block title="פרטי ההורה / האפוטרופוס">
        <Field label="שם מלא" value={agreement.parent_name} />
        <Field label="מספר ת.ז" value={maskIdNumber(agreement.parent_id_number)} />
        <Field label="טלפון נייד" value={formatPhoneToLocal(agreement.parent_phone)} />
        <Field label='דוא"ל' value={agreement.parent_email} />
      </Block>

      <Block title="פרטי החניך/ה">
        <Field label="שם מלא" value={agreement.child_name} />
        <Field label="תאריך לידה" value={agreement.child_birthdate ? ddmmyyyy(agreement.child_birthdate) : null} />
        <div className="sm:col-span-2">
          <Field label="אלרגיות / מגבלות רפואיות ידועות" value={agreement.medical_notes} />
        </div>
      </Block>

      <Block title="פרטי המסלול הנרכש">
        <Field label="סוג מסלול" value={agreement.plan_name} />
        <Field label="תאריך תחילה" value={ddmmyyyy(agreement.plan_start_on)} />
        <Field
          label="עלות"
          value={`₪${Number(agreement.plan_price_ils).toLocaleString("he-IL")}`}
        />
        <Field label="אמצעי תשלום" value={agreement.payment_method} />
      </Block>

      <Block title="איש קשר נוסף למקרה חירום">
        <Field label="שם מלא" value={agreement.emergency_contact_name} />
        <Field
          label="טלפון"
          value={formatPhoneToLocal(agreement.emergency_contact_phone)}
        />
      </Block>

      <section className="space-y-2 rounded-2xl border p-4 text-sm">
        <h2 className="font-bold">הצהרות ואישורים</h2>
        <p>[x] אני מצהיר/ה כי החניך/ה כשיר/ה מבחינה בריאותית להשתתף בפעילות גופנית.</p>
        <p>
          [x] אני מאשר/ת כי קראתי את תקנון Garden Of Eden במלואו (גרסה{" "}
          {agreement.agreement_version}) ואני מסכים/ה לו.
        </p>
        <p>[x] אני מסמיך/ה את גארדן אוף עדן לחייב את אמצעי התשלום שנמסר.</p>
        <p>{agreement.photo_consent ? "[x] מאשר/ת צילום" : "[x] לא מעוניין/ת בצילום"}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="שם ההורה + חתימה" value={agreement.signature_name} />
        <Field label="תאריך" value={agreement.signed_at ? new Date(agreement.signed_at).toLocaleDateString("he-IL") : null} />
      </section>
      <p className="text-center text-xs text-muted-foreground">
        נחתם דיגיטלית בתאריך {agreement.signed_at ? new Date(agreement.signed_at).toLocaleString("he-IL") : ""}. Garden of
        Eden, Boutique Soccer Field
      </p>
    </article>
  );
}
