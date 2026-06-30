import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Dumbbell } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listBookAdminTree } from "@/features/development-book/lib/actions/admin-book-categories";
import { BookCategoryClient } from "@/components/admin/book/BookCategoryClient";

export const metadata: Metadata = {
  title: "ספר פיתוח שחקן | Garden of Eden",
};

export default async function AdminBookPage() {
  const categories = await listBookAdminTree();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">ספר פיתוח שחקן</h1>
          <p className="text-muted-foreground">
            ניהול קטגוריות ופרמטרים של ספר הפיתוח
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/book/muscles">
            <Dumbbell className="h-4 w-4 ms-2" />
            ניהול שרירים
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            קטגוריות ({categories.length})
          </CardTitle>
          <CardDescription>
            סדר הקטגוריות קובע את הסדר שבו הן מופיעות לשחקנים
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BookCategoryClient initialCategories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
