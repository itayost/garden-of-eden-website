import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הרשמה | Garden of Eden",
  description: "בחירת מסלול אימונים, חתימה על הסכם ההרשמה ותשלום מאובטח.",
  alternates: { canonical: "/join" },
};

/**
 * Each /join page wraps itself in JoinFrame: only the page knows which
 * branch the parent is buying at (from the link, the product, or the order).
 */
export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="outline-none min-h-screen bg-paper">
      {children}
    </main>
  );
}
