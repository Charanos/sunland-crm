import { DashboardOverview } from "@/components/sunland/dashboard-overview";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }> | { entity?: string };
}) {
  const resolvedParams = await searchParams;
  const entityId = resolvedParams?.entity;
  return <DashboardOverview entityId={entityId} />;
}
