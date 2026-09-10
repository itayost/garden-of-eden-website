import { isValidUUID } from "@/lib/validations/common";
import { OrderStatusPoller } from "@/features/enrollment/components/OrderStatusPoller";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "התשלום התקבל", robots: { index: false, follow: false } };

interface PageProps {
  searchParams: Promise<{ order?: string }>;
}

export default async function JoinSuccessPage({ searchParams }: PageProps) {
  const { order } = await searchParams;
  return (
    <div className="mx-auto max-w-lg rounded-3xl border bg-white p-10">
      {order && isValidUUID(order) ? (
        <OrderStatusPoller orderId={order} />
      ) : (
        <p className="text-center text-black/60">אישור התשלום יגיע בוואטסאפ.</p>
      )}
    </div>
  );
}
