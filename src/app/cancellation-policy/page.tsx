import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  BUSINESS_DETAILS,
  CANCELLATION_POLICY_VERSION,
  CANCELLATION_SECTIONS,
} from "../../../content/cancellation-policy";

export const metadata: Metadata = {
  title: "מדיניות ביטול עסקה - Garden of Eden",
  description: "תנאי ביטול עסקה והחזר כספי באקדמיית Garden of Eden",
};

export default function CancellationPolicyPage() {
  return (
    <main className="bg-[#F5F5F0] min-h-screen">
      <Navbar />

      <div className="container mx-auto px-6 py-24 max-w-4xl">
        <h1 className="text-4xl font-bold mb-4 text-[#1a1a1a]">מדיניות ביטול עסקה</h1>
        <p className="text-gray-500 mb-12">גרסה {CANCELLATION_POLICY_VERSION}</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          {CANCELLATION_SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">{section.title}</h2>
              <ul className="list-disc space-y-2 ps-5">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}

          <section className="rounded-2xl border border-black/10 bg-white p-6">
            <h2 className="text-xl font-bold mb-3 text-[#1a1a1a]">פרטי העסק</h2>
            <dl className="grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-6">
              <dt className="text-gray-500">שם העסק</dt>
              <dd>{BUSINESS_DETAILS.name_he}</dd>
              {BUSINESS_DETAILS.registration_number && (
                <>
                  <dt className="text-gray-500">מספר עוסק</dt>
                  <dd dir="ltr" className="text-right">{BUSINESS_DETAILS.registration_number}</dd>
                </>
              )}
              <dt className="text-gray-500">טלפון</dt>
              <dd>
                <a href={`tel:${BUSINESS_DETAILS.phone_e164}`} className="underline">
                  {BUSINESS_DETAILS.phone}
                </a>
              </dd>
              <dt className="text-gray-500">דוא&quot;ל</dt>
              <dd>
                <a href={`mailto:${BUSINESS_DETAILS.email}`} className="underline" dir="ltr">
                  {BUSINESS_DETAILS.email}
                </a>
              </dd>
              <dt className="text-gray-500">מקום הפעילות</dt>
              <dd>{BUSINESS_DETAILS.city}</dd>
            </dl>
          </section>

          <p className="text-sm text-gray-500">
            ראו גם את <Link href="/terms-of-service" className="underline">תנאי השימוש</Link> ואת{" "}
            <Link href="/privacy-policy" className="underline">מדיניות הפרטיות</Link>.
          </p>
        </div>
      </div>

      <Footer />
    </main>
  );
}
