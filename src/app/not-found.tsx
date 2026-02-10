import Link from "next/link";
import { Home, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center max-w-md mx-auto px-4">
        <p className="text-9xl font-bold text-muted-foreground/20">404</p>
        <h1 className="text-2xl font-bold mt-4">הדף לא נמצא</h1>
        <p className="text-muted-foreground mt-2">
          הדף שחיפשתם לא קיים או שהועבר למיקום אחר.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button asChild>
            <Link href="/">
              <Home className="h-4 w-4" />
              חזרה לדף הבית
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowRight className="h-4 w-4" />
              לאזור האישי
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
