import type { Metadata } from "next";
import { listMuscles } from "@/features/development-book/lib/actions/admin-book-muscles";
import { MusclesClient } from "@/features/development-book/components/admin/MusclesClient";

export const metadata: Metadata = {
  title: "ניהול שרירים | Garden of Eden",
};

export default async function AdminBookMusclesPage() {
  const muscles = await listMuscles();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">ניהול שרירים</h1>
        <p className="text-muted-foreground">
          ניהול רשימת השרירים המשמשים בתרגילי ספר הפיתוח
        </p>
      </div>

      <MusclesClient initialMuscles={muscles} />
    </div>
  );
}
