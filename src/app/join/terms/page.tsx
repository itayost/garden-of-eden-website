import type { Metadata } from "next";
import { TermsBody } from "@/features/enrollment/components/TermsSheet";

export const metadata: Metadata = { title: "תקנון סניף קריית אתא | Garden of Eden" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-3xl border bg-white p-6 sm:p-10">
      <h1 className="mb-6 text-3xl font-bold">תקנון סניף קריית אתא</h1>
      <TermsBody />
    </article>
  );
}
