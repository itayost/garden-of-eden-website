import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הרשמה לסניף קריית אתא | Garden of Eden",
  description: "בחירת מסלול אימונים, חתימה על הסכם ההרשמה ותשלום מאובטח.",
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F5F5F0] py-10">
      <div className="container mx-auto max-w-5xl px-4">{children}</div>
    </main>
  );
}
