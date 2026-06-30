import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listPrograms } from "@/features/workouts/lib/actions";
import { ProgramList } from "@/features/workouts/components/ProgramList";

export const metadata: Metadata = {
  title: "תוכניות אימון | Garden of Eden",
};

export default async function AdminProgramsPage() {
  const programs = await listPrograms();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">תוכניות אימון</h1>
        <p className="text-muted-foreground">
          ניהול תוכניות אימון — צור, ערוך, שכפל ומחק תוכניות
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>תוכניות</CardTitle>
          <CardDescription>
            לחץ על שם תוכנית כדי לערוך את לוח התרגילים שלה
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProgramList programs={programs} />
        </CardContent>
      </Card>
    </div>
  );
}
