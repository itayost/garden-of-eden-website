import Link from "next/link";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A1F0A] to-[#142814]">
      {/* Header */}
      <header className="py-6">
        <div className="container mx-auto px-4">
          <Link
            href="/"
            className="font-display text-2xl text-[#22C55E] tracking-wider"
          >
            GARDEN OF EDEN
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {children}
      </main>
    </div>
  );
}
