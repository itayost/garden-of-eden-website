import { redirect, notFound } from "next/navigation";
import { isValidUUID } from "@/lib/utils/uuid";

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function StatsUserPage({ params }: Props) {
  const { userId } = await params;

  // Validate userId is a proper UUID to prevent redirect manipulation
  if (!isValidUUID(userId)) {
    notFound();
  }

  redirect(`/admin/assessments/${userId}`);
}
