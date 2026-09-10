import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/actions/shared";
import { listProductsAction } from "@/features/plans/lib/actions/admin-products";
import { ProductsClient } from "@/features/plans/components/admin/ProductsClient";

export const metadata: Metadata = { title: "קטלוג מסלולים | Garden of Eden" };

export default async function AdminProductsPage() {
  const { error } = await verifyAdmin();
  if (error) redirect("/admin");
  const products = await listProductsAction();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">קטלוג מסלולים</h1>
        <p className="text-muted-foreground">
          המחירים והתנאים שמוצגים בעמוד ההרשמה של קריית אתא
        </p>
      </div>
      <ProductsClient initialProducts={products} />
    </div>
  );
}
