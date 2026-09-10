import { isValidUUID } from "@/lib/validations/common";
import { OrderStatusPoller } from "@/features/enrollment/components/OrderStatusPoller";

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
