import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function StatsUserPage({ params }: Props) {
  const { userId } = await params;
  redirect(`/admin/assessments/${userId}`);
}
