"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Card className="max-w-md w-full mx-auto text-center p-6">
        <CardContent className="flex flex-col items-center gap-4 p-0">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">שגיאה בטעינת הדשבורד</h2>
          <p className="text-muted-foreground text-sm">
            אירעה שגיאה בטעינת הנתונים. נסו לרענן את הדף.
          </p>
          <div className="flex gap-3">
            <Button onClick={reset}>נסו שוב</Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">חזרה לדשבורד</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
