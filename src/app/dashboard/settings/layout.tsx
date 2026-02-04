import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הגדרות | Garden of Eden",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-muted-foreground">נהלו את החשבון והאבטחה שלכם</p>
      </div>
      {children}
    </div>
  )
}
