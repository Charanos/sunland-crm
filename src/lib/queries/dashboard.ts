import {
  executiveDashboardMock,
  type ExecutiveDashboardMock,
} from "@/lib/mock-data/sunland";
import { getCached } from "@/lib/cache/upstash";

export type ExecutiveDashboardData = ExecutiveDashboardMock;

async function fetchExecutiveDashboard(): Promise<ExecutiveDashboardData> {
  return executiveDashboardMock;
}

export function getExecutiveDashboard() {
  return getCached("dashboard:ceo:overview", fetchExecutiveDashboard, 300);
}

export async function getExecutiveKpis() {
  const dashboard = await getExecutiveDashboard();

  return {
    pipelineValueKes:
      dashboard.kpis.find((item) => item.id === "pipeline-value")?.value ?? 0,
    rentCollectionRate:
      dashboard.kpis.find((item) => item.id === "rent-collection")?.value ?? 0,
    occupancyRate:
      dashboard.kpis.find((item) => item.id === "occupancy")?.value ?? 0,
    revenueMtdKes: dashboard.finance.revenueMtdKes,
  };
}
